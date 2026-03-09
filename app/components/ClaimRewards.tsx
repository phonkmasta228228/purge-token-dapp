'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('6K6md8GFmT8fncNbWqHSJrduYfG6HgnFCp34jdouGVSM');
const PURGE_MINT = new PublicKey('ENJrUxHe2tBy3SZp3AHp94Urra1Hs5eNyNWh9hJ8G7a5');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';

interface UserMintData {
  slotId: number;
  owner: string;
  cRank: bigint;
  amp: bigint;
  reward: bigint;
  termDays: bigint;
  maturityTs: bigint;
  active: boolean;
}

interface CounterData {
  totalMinted: number;
  activeCount: number;
  nextSlot: number;
}

function getUserCounterPDA(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_counter'), userPubkey.toBuffer()],
    PROGRAM_ID
  );
}

function getUserMintPDA(userPubkey: PublicKey, slotId: number): [PublicKey, number] {
  const slotBuf = Buffer.alloc(4);
  slotBuf.writeUInt32LE(slotId, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_mint'), userPubkey.toBuffer(), slotBuf],
    PROGRAM_ID
  );
}

function parseCounter(data: Buffer): CounterData {
  // UserCounter layout: 8 disc | 4 next_slot_index (u32) | 4 active_mints (u32) | 1 bump
  let offset = 8;
  const nextSlot = data.readUInt32LE(offset); offset += 4;
  const activeCount = data.readUInt32LE(offset);
  return { totalMinted: nextSlot, activeCount, nextSlot };
}

function parseUserMint(data: Buffer, slotId: number): UserMintData {
  // UserMint layout: 8 disc | 32 owner | 4 slot_index (u32) | 8 term_days (u64) |
  //                  8 mature_ts (i64) | 8 rank (u64) | 8 amp (u64) | 8 reward (u64) | 1 claimed | 1 bump
  let offset = 8;
  const owner = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
  const parsedSlotId = data.readUInt32LE(offset); offset += 4;
  const termDays = data.readBigUInt64LE(offset); offset += 8;
  const maturityTs = BigInt(data.readBigInt64LE(offset)); offset += 8;
  const cRank = data.readBigUInt64LE(offset); offset += 8;
  const amp = data.readBigUInt64LE(offset); offset += 8;
  const reward = data.readBigUInt64LE(offset); offset += 8;
  const claimed = data[offset] === 1;
  const active = !claimed;
  return { slotId: parsedSlotId, owner, cRank, amp, reward, termDays, maturityTs, active };
}

function formatPurge(amount: number): string {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
  if (amount >= 1_000) return (amount / 1_000).toFixed(1) + 'K';
  return amount.toLocaleString();
}

function getCountdown(maturityTs: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (maturityTs <= now) return 'Ready to claim';
  const diff = Number(maturityTs - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h remaining`;
}

async function getDiscriminator(name: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(name);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(hashBuffer).slice(0, 8);
}

function encodeU32LE(val: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, val, true);
  return buf;
}

export const ClaimRewards: FC = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [counter, setCounter] = useState<CounterData | null>(null);
  const [mints, setMints] = useState<UserMintData[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null); // slot being claimed
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimAllResults, setClaimAllResults] = useState<{ sigs: string[]; failed: number[] } | null>(null);
  const [txSigs, setTxSigs] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  const loadData = useCallback(async (pubkey: PublicKey) => {
    setLoading(true);
    try {
      const conn = new Connection(X1_RPC, 'confirmed');

      // Load counter first
      const [counterPDA] = getUserCounterPDA(pubkey);
      const counterInfo = await conn.getAccountInfo(counterPDA);
      if (!counterInfo || counterInfo.data.length < 17) {
        setCounter(null);
        setMints([]);
        return;
      }

      const counterData = parseCounter(counterInfo.data as Buffer);
      setCounter(counterData);

      if (counterData.nextSlot === 0) {
        setMints([]);
        return;
      }

      // Scan all slots 0..nextSlot in parallel
      const slotRange = Array.from({ length: counterData.nextSlot }, (_, i) => i);
      const results = await Promise.allSettled(
        slotRange.map(async (slotId) => {
          const [mintPDA] = getUserMintPDA(pubkey, slotId);
          const info = await conn.getAccountInfo(mintPDA);
          if (!info || info.data.length < 8 + 32 + 4 + 8 + 8 + 8 + 8 + 8 + 1 + 1) return null; // 86 bytes
          return parseUserMint(info.data as Buffer, slotId);
        })
      );

      const activeMints: UserMintData[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value && result.value.active) {
          activeMints.push(result.value);
        }
      }

      // Sort by maturity (soonest first)
      activeMints.sort((a, b) => Number(a.maturityTs - b.maturityTs));
      setMints(activeMints);
    } catch {
      setCounter(null);
      setMints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setCounter(null);
      setMints([]);
      return;
    }
    loadData(publicKey);
  }, [publicKey, loadData]);

  const handleClaimReward = useCallback(async (mint: UserMintData) => {
    if (!publicKey || !sendTransaction) return;
    const slotId = mint.slotId;
    setClaiming(slotId);
    setErrors(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setTxSigs(prev => { const n = { ...prev }; delete n[slotId]; return n; });

    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const [userMintPDA] = getUserMintPDA(publicKey, slotId);
      const [counterPDA] = getUserCounterPDA(publicKey);
      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')], PROGRAM_ID
      );
      const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint_authority')], PROGRAM_ID
      );

      const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      const userTokenAccount = await getAssociatedTokenAddress(PURGE_MINT, publicKey);

      // Anchor discriminator for claim_mint_reward
      const discriminator = await getDiscriminator('global:claim_mint_reward');
      // Args: slot_index as u32 LE
      const slotBuf = encodeU32LE(slotId);
      const ixData = Buffer.from(new Uint8Array([...discriminator, ...slotBuf]));

      const { blockhash } = await conn.getLatestBlockhash('confirmed');
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      // Create ATA if it doesn't exist
      const ataInfo = await conn.getAccountInfo(userTokenAccount);
      if (!ataInfo) {
        tx.add(createAssociatedTokenAccountInstruction(
          publicKey, userTokenAccount, publicKey, PURGE_MINT,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
        ));
      }

      // Account order must match Anchor's ClaimMintReward struct:
      // user_counter, user_mint, global_state, mint, mint_authority,
      // user_token_account, user, system_program, token_program, associated_token_program
      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: counterPDA,                    isSigner: false, isWritable: true  },
          { pubkey: userMintPDA,                   isSigner: false, isWritable: true  },
          { pubkey: globalStatePDA,                isSigner: false, isWritable: true  },
          { pubkey: PURGE_MINT,                    isSigner: false, isWritable: true  },
          { pubkey: mintAuthorityPDA,              isSigner: false, isWritable: false },
          { pubkey: userTokenAccount,              isSigner: false, isWritable: true  },
          { pubkey: publicKey,                     isSigner: true,  isWritable: true  },
          { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID,              isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false },
        ],
        data: ixData,
      });
      tx.add(ix);

      const sig = await sendTransaction(tx, conn, { skipPreflight: false, preflightCommitment: 'confirmed' });
      await conn.confirmTransaction(sig, 'confirmed');
      setTxSigs(prev => ({ ...prev, [slotId]: sig }));

      // Refresh data after claim
      await loadData(publicKey);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      let friendly = msg;
      if (msg.includes('NotMature') || msg.includes('MaturityNotReached')) {
        friendly = 'Not yet mature — come back when your term expires.';
      } else if (msg.includes('NoActiveRank')) {
        friendly = 'No active mint found for this slot.';
      }
      setErrors(prev => ({ ...prev, [slotId]: friendly }));
    } finally {
      setClaiming(null);
    }
  }, [publicKey, sendTransaction, loadData]);

  const handleClaimAll = useCallback(async () => {
    if (!publicKey || !sendTransaction) return;
    const matureMints = mints.filter(m => BigInt(Math.floor(Date.now() / 1000)) >= m.maturityTs);
    if (matureMints.length === 0) return;

    setClaimingAll(true);
    setClaimAllResults(null);

    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      const userTokenAccount = await getAssociatedTokenAddress(PURGE_MINT, publicKey);
      const [counterPDA] = getUserCounterPDA(publicKey);
      const [globalStatePDA] = PublicKey.findProgramAddressSync([Buffer.from('global_state')], PROGRAM_ID);
      const [mintAuthorityPDA] = PublicKey.findProgramAddressSync([Buffer.from('mint_authority')], PROGRAM_ID);
      const discriminator = await getDiscriminator('global:claim_mint_reward');

      // Create ATA if needed
      const ataInfo = await conn.getAccountInfo(userTokenAccount);
      const needsAta = !ataInfo;

      const BATCH_SIZE = 16;
      const batches: UserMintData[][] = [];
      for (let i = 0; i < matureMints.length; i += BATCH_SIZE) {
        batches.push(matureMints.slice(i, i + BATCH_SIZE));
      }

      const sigs: string[] = [];
      const failed: number[] = [];

      for (let bi = 0; bi < batches.length; bi++) {
        const batch = batches[bi];
        try {
          const { blockhash } = await conn.getLatestBlockhash('confirmed');
          const tx = new Transaction();
          tx.recentBlockhash = blockhash;
          tx.feePayer = publicKey;

          // Only add ATA ix on first batch
          if (bi === 0 && needsAta) {
            tx.add(createAssociatedTokenAccountInstruction(
              publicKey, userTokenAccount, publicKey, PURGE_MINT,
              TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
            ));
          }

          for (const mint of batch) {
            const [userMintPDA] = getUserMintPDA(publicKey, mint.slotId);
            const slotBuf = encodeU32LE(mint.slotId);
            const ixData = Buffer.from(new Uint8Array([...discriminator, ...slotBuf]));
            tx.add(new TransactionInstruction({
              programId: PROGRAM_ID,
              keys: [
                { pubkey: counterPDA,                  isSigner: false, isWritable: true  },
                { pubkey: userMintPDA,                 isSigner: false, isWritable: true  },
                { pubkey: globalStatePDA,              isSigner: false, isWritable: true  },
                { pubkey: PURGE_MINT,                  isSigner: false, isWritable: true  },
                { pubkey: mintAuthorityPDA,            isSigner: false, isWritable: false },
                { pubkey: userTokenAccount,            isSigner: false, isWritable: true  },
                { pubkey: publicKey,                   isSigner: true,  isWritable: true  },
                { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
              ],
              data: ixData,
            }));
          }

          const sig = await sendTransaction(tx, conn, { skipPreflight: false, preflightCommitment: 'confirmed' });
          await conn.confirmTransaction(sig, 'confirmed');
          sigs.push(sig);
        } catch {
          failed.push(...batch.map(m => m.slotId));
        }
      }

      setClaimAllResults({ sigs, failed });
      await loadData(publicKey);
    } finally {
      setClaimingAll(false);
    }
  }, [publicKey, sendTransaction, mints, loadData]);

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-xl font-black text-[#00FFAA] tracking-widest mb-2">CLAIM REWARDS</h2>
        <p className="text-[#555] mb-6 text-sm">Connect your wallet to view your active mints</p>
        <WalletMultiButton />
      </div>
    );
  }

  const now = BigInt(Math.floor(Date.now() / 1000));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">CLAIM REWARDS</h1>
        <p className="text-[#555] text-sm">Your active mints and claimable PURGE.</p>
      </div>

      {/* Counter summary */}
      {counter !== null && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="bg-[#111] border border-[#1a1a1a] rounded p-3 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Active</div>
            <div className="text-xl font-black text-[#00FFAA]">{counter.activeCount}</div>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded p-3 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Future Claims</div>
            <div className="text-xl font-black text-white">
              {formatPurge(mints
                .filter(m => BigInt(Math.floor(Date.now() / 1000)) < m.maturityTs)
                .reduce((sum, m) => sum + Number(m.reward > 0n ? m.reward : m.amp * m.termDays), 0))}
            </div>
            <div className="text-xs text-[#444] mt-1">PURGE pending</div>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded p-3 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Matured</div>
            <div className="text-xl font-black text-[#00FFAA]">
              {formatPurge(mints
                .filter(m => BigInt(Math.floor(Date.now() / 1000)) >= m.maturityTs)
                .reduce((sum, m) => sum + Number(m.reward > 0n ? m.reward : m.amp * m.termDays), 0))}
            </div>
            <div className="text-xs text-[#444] mt-1">PURGE ready</div>
          </div>
        </div>
      )}

      {/* Claim All button — only shown when mature mints exist */}
      {!loading && mints.filter(m => BigInt(Math.floor(Date.now() / 1000)) >= m.maturityTs).length > 1 && (
        <div className="mb-6">
          <button
            onClick={handleClaimAll}
            disabled={claimingAll || claiming !== null}
            className="w-full py-4 bg-[#00FFAA] text-black font-black text-sm tracking-widest rounded
              hover:bg-[#00cc88] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase"
          >
            {claimingAll ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                Claiming All...
              </span>
            ) : `🎯 Claim All (${mints.filter(m => BigInt(Math.floor(Date.now() / 1000)) >= m.maturityTs).length} Mature)`}
          </button>

          {claimAllResults && (
            <div className="mt-3 space-y-2">
              {claimAllResults.sigs.map((sig, i) => (
                <div key={sig} className="bg-[#001a0d] border border-[#00FFAA33] rounded p-3 text-xs space-y-1">
                  <div className="text-[#00FFAA] font-bold">✓ Batch {i + 1} claimed</div>
                  <a href={`https://explorer.mainnet.x1.xyz/tx/${sig}`} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-[#00FFAA] break-all hover:underline">{sig}</a>
                </div>
              ))}
              {claimAllResults.failed.length > 0 && (
                <div className="bg-[#1a0000] border border-[#ff000033] rounded p-3 text-xs text-[#ff6666]">
                  ⚠ Failed slots: {claimAllResults.failed.join(', ')} — try claiming individually
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-[#555] text-sm animate-pulse">Loading on-chain data...</div>
      )}

      {!loading && (counter === null || mints.length === 0) && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-8 text-center">
          <div className="text-[#555] mb-2">No active mints found</div>
          <div className="text-xs text-[#444]">Go to the Mint tab to claim a rank first.</div>
        </div>
      )}

      {/* Mint cards grid */}
      {!loading && mints.length > 0 && (
        <div className="space-y-3">
          {mints.map((mint) => {
            const isMature = now >= mint.maturityTs;
            const maturityDate = new Date(Number(mint.maturityTs) * 1000);
            const isClaiming = claiming === mint.slotId;
            const sig = txSigs[mint.slotId];
            const err = errors[mint.slotId];

            return (
              <div
                key={mint.slotId}
                className={`bg-[#111] border rounded-lg p-5 ${
                  isMature ? 'border-[#00FFAA33]' : 'border-[#1a1a1a]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Slot #{mint.slotId}</div>
                    <div className="text-lg font-black text-white">Rank #{mint.cRank.toString()}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-widest ${
                    isMature
                      ? 'bg-[#001a0d] text-[#00FFAA] border border-[#00FFAA33]'
                      : 'bg-[#1a1000] text-yellow-400 border border-yellow-800'
                  }`}>
                    {isMature ? '✓ Mature' : getCountdown(mint.maturityTs)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                  <div>
                    <div className="text-xs text-[#555] mb-1">Term</div>
                    <div className="font-mono text-[#888]">{mint.termDays.toString()} days</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#555] mb-1">Matures</div>
                    <div className="font-mono text-[#888]">
                      {maturityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#555] mb-1">PURGE</div>
                    <div className={`font-mono font-bold ${isMature ? 'text-[#00FFAA]' : 'text-[#888]'}`}>
                      {formatPurge(Number(mint.reward > 0n ? mint.reward : mint.amp * mint.termDays))}
                    </div>
                  </div>
                </div>

                {isMature && !sig && (
                  <button
                    onClick={() => handleClaimReward(mint)}
                    disabled={isClaiming || claiming !== null}
                    className="w-full py-3 bg-[#00FFAA] text-black font-black text-sm tracking-widest rounded
                      hover:bg-[#00cc88] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                  >
                    {isClaiming ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                        Claiming...
                      </span>
                    ) : '🎯 Claim PURGE Reward'}
                  </button>
                )}

                {!isMature && (
                  <div className="w-full py-3 bg-[#0d0d0d] border border-[#1a1a1a] text-[#555] text-xs tracking-widest rounded text-center uppercase">
                    ⏳ {getCountdown(mint.maturityTs)}
                  </div>
                )}

                {sig && (
                  <div className="bg-[#001a0d] border border-[#00FFAA33] rounded p-3 text-xs space-y-1">
                    <div className="text-[#00FFAA] font-bold">✓ PURGE Claimed!</div>
                    <a href={`https://explorer.mainnet.x1.xyz/tx/${sig}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[#00FFAA] break-all hover:underline">{sig}</a>
                  </div>
                )}

                {err && (
                  <div className="bg-[#1a0000] border border-[#ff000033] rounded p-3 text-xs text-[#ff6666]">
                    ⚠ {err}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('8g6XCgTdm5WnQmFRZYu4DMUCJyKU1JWxKmQ16KqweP2n');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';
const SECONDS_PER_DAY = 86400;

interface UserRankData {
  owner: string;
  cRank: bigint;
  term: bigint;      // seconds
  maturityTs: bigint;
  active: boolean;
}

function parseUserRank(data: Buffer): UserRankData {
  // Layout (after 8-byte discriminator):
  // 32 bytes: owner pubkey
  // 8 bytes:  c_rank (u64 LE)
  // 8 bytes:  term (u64 LE)
  // 8 bytes:  maturity_ts (u64 LE)
  // 1 byte:   active (bool)
  // 1 byte:   bump
  let offset = 8;
  const owner = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;
  const cRank = data.readBigUInt64LE(offset); offset += 8;
  const term = data.readBigUInt64LE(offset); offset += 8;
  const maturityTs = data.readBigUInt64LE(offset); offset += 8;
  const active = data[offset] === 1;
  return { owner, cRank, term, maturityTs, active };
}

function getCountdown(maturityTs: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (maturityTs <= now) return 'Ready to claim';
  const diff = Number(maturityTs - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

function isMature(maturityTs: bigint): boolean {
  return BigInt(Math.floor(Date.now() / 1000)) >= maturityTs;
}

export const ClaimRewards: FC = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [rankData, setRankData] = useState<UserRankData | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getUserRankPDA = useCallback((userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_rank'), userPubkey.toBuffer()],
      PROGRAM_ID
    );
  }, []);

  // Load on-chain rank data
  useEffect(() => {
    if (!publicKey) { setRankData(null); return; }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const conn = new Connection(X1_RPC, 'confirmed');
        const [pda] = getUserRankPDA(publicKey);
        const info = await conn.getAccountInfo(pda);
        if (!info || info.data.length < 58 + 8) {
          setRankData(null);
        } else {
          setRankData(parseUserRank(info.data as unknown as Buffer));
        }
      } catch (e) {
        setError('Failed to load rank data from chain.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [publicKey, getUserRankPDA, txSig]);

  const handleClaimReward = useCallback(async () => {
    if (!publicKey || !sendTransaction || !rankData) return;
    setClaiming(true);
    setError(null);
    setTxSig(null);
    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const [userRankPDA] = getUserRankPDA(publicKey);
      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')], PROGRAM_ID
      );
      const [xenMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('xen_mint')], PROGRAM_ID
      );
      const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint_authority')], PROGRAM_ID
      );

      // Derive user's associated token account
      const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      const userTokenAccount = await getAssociatedTokenAddress(xenMintPDA, publicKey);

      // Anchor discriminator for claim_mint_reward
      const encoded = new TextEncoder().encode('global:claim_mint_reward');
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: userRankPDA, isSigner: false, isWritable: true },
          { pubkey: globalStatePDA, isSigner: false, isWritable: true },
          { pubkey: xenMintPDA, isSigner: false, isWritable: true },
          { pubkey: mintAuthorityPDA, isSigner: false, isWritable: false },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(discriminator),
      });

      const { blockhash } = await conn.getLatestBlockhash('confirmed');
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      tx.add(ix);

      const sig = await sendTransaction(tx, conn, { skipPreflight: false, preflightCommitment: 'confirmed' });
      await conn.confirmTransaction(sig, 'confirmed');
      setTxSig(sig);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('MaturityNotReached') || msg.includes('0x1773')) {
        setError('Not yet mature — come back when the term expires.');
      } else if (msg.includes('NoActiveRank') || msg.includes('0x1772')) {
        setError('No active rank found for this wallet.');
      } else {
        setError(msg);
      }
    } finally {
      setClaiming(false);
    }
  }, [publicKey, sendTransaction, rankData, getUserRankPDA]);

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-xl font-black text-[#00FFAA] tracking-widest mb-2">CLAIM REWARDS</h2>
        <p className="text-[#555] mb-6 text-sm">Connect your wallet to view your active claim</p>
        <WalletMultiButton />
      </div>
    );
  }

  const termDays = rankData ? Number(rankData.term) / SECONDS_PER_DAY : 0;
  const maturityDate = rankData ? new Date(Number(rankData.maturityTs) * 1000) : null;
  const mature = rankData ? isMature(rankData.maturityTs) : false;

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">CLAIM REWARDS</h1>
        <p className="text-[#555] text-sm">Your on-chain rank status and claimable PURGE.</p>
      </div>

      {loading && (
        <div className="text-center py-16 text-[#555] text-sm">Loading on-chain data...</div>
      )}

      {!loading && !rankData && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-8 text-center">
          <div className="text-[#555] mb-2">No active rank found</div>
          <div className="text-xs text-[#444]">Go to the Mint tab to claim a rank first.</div>
        </div>
      )}

      {!loading && rankData && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 space-y-5">

          {/* Rank info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 text-center">
              <div className="text-xs text-[#555] uppercase tracking-widest mb-1">cRank</div>
              <div className="text-2xl font-black text-[#00FFAA]">#{rankData.cRank.toString()}</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 text-center">
              <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Term</div>
              <div className="text-2xl font-black text-white">{termDays}<span className="text-sm font-normal text-[#555]"> days</span></div>
            </div>
          </div>

          {/* Maturity */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#555]">Maturity Date</span>
              <span className="font-mono text-[#888]">
                {maturityDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555]">Status</span>
              <span className={`font-bold ${mature ? 'text-[#00FFAA]' : 'text-yellow-400'}`}>
                {rankData.active ? (mature ? '✓ Ready to Claim' : getCountdown(rankData.maturityTs)) : '◆ Already Claimed'}
              </span>
            </div>
          </div>

          {/* Action */}
          {rankData.active && mature && (
            <button
              onClick={handleClaimReward}
              disabled={claiming}
              className="w-full py-4 bg-[#00FFAA] text-black font-black text-sm tracking-widest rounded
                hover:bg-[#00cc88] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase"
            >
              {claiming ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                  Claiming...
                </span>
              ) : '🎯 Claim PURGE Reward'}
            </button>
          )}

          {rankData.active && !mature && (
            <div className="w-full py-4 bg-[#1a1000] border border-yellow-800 text-yellow-500 font-black text-sm tracking-widest rounded text-center uppercase">
              ⏳ {getCountdown(rankData.maturityTs)}
            </div>
          )}

          {!rankData.active && (
            <div className="w-full py-4 bg-[#0d0d0d] border border-[#1a1a1a] text-[#555] font-black text-sm tracking-widest rounded text-center uppercase">
              ◆ Reward Already Claimed
            </div>
          )}

          {txSig && (
            <div className="bg-[#001a0d] border border-[#00FFAA33] rounded p-4 text-xs space-y-2">
              <div className="text-[#00FFAA] font-bold">✓ PURGE Claimed!</div>
              <a
                href={`https://explorer.mainnet.x1.xyz/tx/${txSig}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#00FFAA] break-all hover:underline"
              >
                {txSig}
              </a>
            </div>
          )}

          {error && (
            <div className="bg-[#1a0000] border border-[#ff000033] rounded p-4 text-xs text-[#ff6666]">
              ⚠ {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

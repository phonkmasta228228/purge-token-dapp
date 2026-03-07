'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('8g6XCgTdm5WnQmFRZYu4DMUCJyKU1JWxKmQ16KqweP2n');
const PURGE_MINT = new PublicKey('CYrMpw3kX92ZtGbLF9p7nQSYt7mj1J1WvDidtt5rpCyP');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';
const SECONDS_PER_DAY = 86400;

interface UserMintData {
  owner: string;
  termDays: bigint;
  matureTs: bigint;
  claimed: boolean;
  rank: bigint;
  rewardAmount: bigint;
}

function parseUserMint(data: Buffer): UserMintData {
  // Layout (after 8-byte discriminator):
  // 32 owner + 8 term_days + 8 mature_ts (i64) + 1 claimed + 8 rank + 8 reward_amount + 1 bump
  let offset = 8;
  const owner = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
  const termDays = data.readBigUInt64LE(offset); offset += 8;
  const matureTs = data.readBigInt64LE(offset); offset += 8;
  const claimed = data[offset] === 1; offset += 1;
  const rank = data.readBigUInt64LE(offset); offset += 8;
  const rewardAmount = data.readBigUInt64LE(offset);
  return { owner, termDays, matureTs: BigInt(matureTs), claimed, rank, rewardAmount };
}

function getCountdown(matureTs: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (matureTs <= now) return 'Ready to claim';
  const diff = Number(matureTs - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

export const ClaimRewards: FC = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [mintData, setMintData] = useState<UserMintData | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getUserMintPDA = useCallback((userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_mint'), userPubkey.toBuffer()],
      PROGRAM_ID
    );
  }, []);

  useEffect(() => {
    if (!publicKey) { setMintData(null); return; }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const conn = new Connection(X1_RPC, 'confirmed');
        const [pda] = getUserMintPDA(publicKey);
        const info = await conn.getAccountInfo(pda);
        if (!info || info.data.length < 8 + 32 + 8 + 8 + 1 + 8 + 8 + 1) {
          setMintData(null);
        } else {
          setMintData(parseUserMint(info.data as unknown as Buffer));
        }
      } catch {
        setError('Failed to load data from chain.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [publicKey, getUserMintPDA, txSig]);

  const handleClaimReward = useCallback(async () => {
    if (!publicKey || !sendTransaction || !mintData) return;
    setClaiming(true);
    setError(null);
    setTxSig(null);
    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const [userMintPDA] = getUserMintPDA(publicKey);
      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')], PROGRAM_ID
      );
      const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint_authority')], PROGRAM_ID
      );

      const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      const userTokenAccount = await getAssociatedTokenAddress(PURGE_MINT, publicKey);

      // Anchor discriminator for claim_mint_reward
      const encoded = new TextEncoder().encode('global:claim_mint_reward');
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

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

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: userMintPDA, isSigner: false, isWritable: true },
          { pubkey: globalStatePDA, isSigner: false, isWritable: true },
          { pubkey: PURGE_MINT, isSigner: false, isWritable: true },
          { pubkey: mintAuthorityPDA, isSigner: false, isWritable: false },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
        ],
        data: Buffer.from(discriminator),
      });
      tx.add(ix);

      const sig = await sendTransaction(tx, conn, { skipPreflight: false, preflightCommitment: 'confirmed' });
      await conn.confirmTransaction(sig, 'confirmed');
      setTxSig(sig);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('NotMature')) {
        setError('Not yet mature — come back when your term expires.');
      } else if (msg.includes('AlreadyClaimed')) {
        setError('Reward already claimed for this rank.');
      } else {
        setError(msg);
      }
    } finally {
      setClaiming(false);
    }
  }, [publicKey, sendTransaction, mintData, getUserMintPDA]);

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

  const now = BigInt(Math.floor(Date.now() / 1000));
  const isMature = mintData ? now >= mintData.matureTs : false;
  const maturityDate = mintData ? new Date(Number(mintData.matureTs) * 1000) : null;

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">CLAIM REWARDS</h1>
        <p className="text-[#555] text-sm">Your on-chain mint status and claimable PURGE.</p>
      </div>

      {loading && (
        <div className="text-center py-16 text-[#555] text-sm animate-pulse">Loading on-chain data...</div>
      )}

      {!loading && !mintData && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-8 text-center">
          <div className="text-[#555] mb-2">No active mint found</div>
          <div className="text-xs text-[#444]">Go to the Mint tab to claim a rank first.</div>
        </div>
      )}

      {!loading && mintData && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 text-center">
              <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Rank</div>
              <div className="text-2xl font-black text-[#00FFAA]">#{mintData.rank.toString()}</div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 text-center">
              <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Term</div>
              <div className="text-2xl font-black text-white">{mintData.termDays.toString()}<span className="text-sm font-normal text-[#555]"> days</span></div>
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#555]">Maturity Date</span>
              <span className="font-mono text-[#888]">
                {maturityDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#555]">Status</span>
              <span className={`font-bold ${mintData.claimed ? 'text-[#555]' : isMature ? 'text-[#00FFAA]' : 'text-yellow-400'}`}>
                {mintData.claimed ? '◆ Claimed' : isMature ? '✓ Ready to Claim' : getCountdown(mintData.matureTs)}
              </span>
            </div>
            {mintData.claimed && mintData.rewardAmount > 0n && (
              <div className="flex justify-between">
                <span className="text-[#555]">Rewarded</span>
                <span className="font-mono text-[#00FFAA]">
                  {(Number(mintData.rewardAmount) / 1e18).toFixed(4)} PURGE
                </span>
              </div>
            )}
          </div>

          {!mintData.claimed && isMature && (
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

          {!mintData.claimed && !isMature && (
            <div className="w-full py-4 bg-[#1a1000] border border-yellow-800 text-yellow-500 font-black text-sm tracking-widest rounded text-center uppercase">
              ⏳ {getCountdown(mintData.matureTs)}
            </div>
          )}

          {mintData.claimed && (
            <div className="w-full py-4 bg-[#0d0d0d] border border-[#1a1a1a] text-[#555] font-black text-sm tracking-widest rounded text-center uppercase">
              ◆ Reward Already Claimed
            </div>
          )}

          {txSig && (
            <div className="bg-[#001a0d] border border-[#00FFAA33] rounded p-4 text-xs space-y-2">
              <div className="text-[#00FFAA] font-bold">✓ PURGE Claimed!</div>
              <a href={`https://explorer.mainnet.x1.xyz/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[#00FFAA] break-all hover:underline">{txSig}</a>
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

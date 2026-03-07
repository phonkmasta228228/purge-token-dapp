'use client';

import { FC, useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('8g6XCgTdm5WnQmFRZYu4DMUCJyKU1JWxKmQ16KqweP2n');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';
const SECONDS_PER_DAY = 86400;

// Anchor discriminator for claim_rank: sha256("global:claim_rank")[0..8]
function getDiscriminator(name: string): Buffer {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(`global:${name}`).digest();
  return hash.slice(0, 8);
}

function getAmplifier(days: number): number {
  if (days <= 1) return 1.0;
  return parseFloat((1 + Math.log(days) * 0.5).toFixed(2));
}

function estimatePurge(days: number): number {
  const base = days * 100;
  const amp = getAmplifier(days);
  return Math.floor(base * amp);
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export const ClaimRank: FC = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [term, setTerm] = useState(30);
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveRank, setHasActiveRank] = useState(false);
  const [checkingRank, setCheckingRank] = useState(false);

  const amplifier = getAmplifier(term);
  const estimated = estimatePurge(term);

  // Derive PDAs
  const getUserRankPDA = useCallback((userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_rank'), userPubkey.toBuffer()],
      PROGRAM_ID
    );
  }, []);

  const getGlobalStatePDA = useCallback(() => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('global_state')],
      PROGRAM_ID
    );
  }, []);

  // Check if user already has active rank
  useEffect(() => {
    if (!publicKey) return;
    const check = async () => {
      setCheckingRank(true);
      try {
        const [userRankPDA] = getUserRankPDA(publicKey);
        const conn = new (await import('@solana/web3.js')).Connection(X1_RPC, 'confirmed');
        const accountInfo = await conn.getAccountInfo(userRankPDA);
        if (accountInfo && accountInfo.data.length > 8) {
          // Parse 'active' field: offset 8 (discriminator) + 32 (owner) + 8 (c_rank) + 8 (term) + 8 (maturity_ts) = 56
          const active = accountInfo.data[8 + 32 + 8 + 8 + 8] === 1;
          setHasActiveRank(active);
        } else {
          setHasActiveRank(false);
        }
      } catch {
        setHasActiveRank(false);
      } finally {
        setCheckingRank(false);
      }
    };
    check();
  }, [publicKey, getUserRankPDA, txSig]);

  const handleClaim = useCallback(async () => {
    if (!connected || !publicKey || !sendTransaction) return;
    setLoading(true);
    setError(null);
    setTxSig(null);

    try {
      const { Connection, Transaction, TransactionInstruction, PublicKey: PK } = await import('@solana/web3.js');
      const conn = new Connection(X1_RPC, 'confirmed');

      const [userRankPDA] = getUserRankPDA(publicKey);
      const [globalStatePDA] = getGlobalStatePDA();

      // Build claim_rank instruction
      // Args: term (u64, little-endian) = days * SECONDS_PER_DAY
      // Encode term as little-endian u64 (browser-safe, no writeBigUInt64LE)
      const termSeconds = term * SECONDS_PER_DAY;
      const termBuf = new Uint8Array(8);
      let val = termSeconds;
      for (let i = 0; i < 8; i++) {
        termBuf[i] = val & 0xff;
        val = Math.floor(val / 256);
      }

      // Anchor discriminator: sha256("global:claim_rank")[0..8] via Web Crypto
      const encoded = new TextEncoder().encode('global:claim_rank');
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

      const data = Buffer.from(new Uint8Array([...discriminator, ...termBuf]));

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: userRankPDA, isSigner: false, isWritable: true },
          { pubkey: globalStatePDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });

      const { blockhash } = await conn.getLatestBlockhash('confirmed');
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      tx.add(ix);

      const sig = await sendTransaction(tx, conn, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // Wait for confirmation
      await conn.confirmTransaction(sig, 'confirmed');
      setTxSig(sig);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Parse Anchor error codes if present
      if (msg.includes('RankAlreadyExists') || msg.includes('0x1771')) {
        setError('You already have an active rank. Claim your reward first.');
      } else if (msg.includes('InvalidTerm') || msg.includes('0x1770')) {
        setError('Invalid term length. Choose between 1 and 500 days.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, sendTransaction, term, getUserRankPDA, getGlobalStatePDA]);

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">CLAIM RANK</h1>
        <p className="text-[#555] text-sm">
          Lock your term. Amplify your rewards. Mint PURGE tokens on X1.
        </p>
      </div>

      {/* Wallet status */}
      {connected && publicKey && (
        <div className="mb-6 flex items-center gap-2 text-xs text-[#555] bg-[#111] border border-[#1a1a1a] rounded px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-[#00FFAA] inline-block"></span>
          <span className="font-mono">{shortenAddress(publicKey.toBase58())}</span>
          <span className="ml-auto text-[#00FFAA]">Connected</span>
          {checkingRank && <span className="text-[#555] ml-2">Checking rank...</span>}
          {!checkingRank && hasActiveRank && (
            <span className="text-yellow-400 ml-2">⚠ Active rank exists</span>
          )}
        </div>
      )}

      {/* Main card */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 space-y-6 glow">

        {/* Term Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-bold tracking-widest text-[#888] uppercase">Term Length</label>
            <span className="text-[#00FFAA] font-black text-lg">{term} <span className="text-sm font-normal text-[#555]">days</span></span>
          </div>
          <input
            type="range"
            min={1}
            max={500}
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-[#444] mt-1">
            <span>1 day</span>
            <span>250 days</span>
            <span>500 days</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Amplifier</div>
            <div className="text-2xl font-black text-[#00FFAA]">{amplifier}×</div>
            <div className="text-xs text-[#444] mt-1">
              {term <= 30 ? 'Novice' : term <= 100 ? 'Adept' : term <= 250 ? 'Veteran' : 'Apex'}
            </div>
          </div>
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Est. PURGE</div>
            <div className="text-2xl font-black text-white">{estimated.toLocaleString()}</div>
            <div className="text-xs text-[#444] mt-1">tokens</div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#555]">Base Reward</span>
            <span className="font-mono text-[#888]">{(term * 100).toLocaleString()} PURGE</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#555]">Amplifier Bonus</span>
            <span className="font-mono text-[#00FFAA]">+{Math.floor((amplifier - 1) * term * 100).toLocaleString()} PURGE</span>
          </div>
          <div className="border-t border-[#1a1a1a] pt-2 flex justify-between">
            <span className="text-[#888] font-bold">Total Claimable</span>
            <span className="font-mono font-black text-white">{estimated.toLocaleString()} PURGE</span>
          </div>
          <div className="flex justify-between text-xs text-[#444]">
            <span>Maturity date</span>
            <span className="font-mono">
              {new Date(Date.now() + term * 86400000).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              })}
            </span>
          </div>
        </div>

        {/* Action */}
        {!connected ? (
          <div className="text-center space-y-3">
            <p className="text-[#555] text-sm">Connect your wallet to claim rank</p>
            <WalletMultiButton />
          </div>
        ) : hasActiveRank ? (
          <div className="w-full py-4 bg-[#1a1a00] border border-yellow-700 text-yellow-400 font-black text-sm tracking-widest rounded text-center uppercase">
            ⚠ Active Rank — Claim Reward First
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full py-4 bg-[#00FFAA] text-black font-black text-sm tracking-widest rounded
              hover:bg-[#00cc88] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
              uppercase"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                Sending Transaction...
              </span>
            ) : (
              `⚡ Claim Rank — ${term} Days`
            )}
          </button>
        )}

        {/* Success */}
        {txSig && (
          <div className="bg-[#001a0d] border border-[#00FFAA33] rounded p-4 text-xs space-y-2">
            <div className="text-[#00FFAA] font-bold">✓ Rank Claimed Successfully</div>
            <div className="text-[#555]">Transaction:</div>
            <a
              href={`https://explorer.mainnet.x1.xyz/tx/${txSig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[#00FFAA] break-all hover:underline"
            >
              {txSig}
            </a>
            <div className="text-[#444] pt-1">
              Come back on{' '}
              <span className="text-white">
                {new Date(Date.now() + term * 86400000).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </span>{' '}
              to claim your PURGE tokens.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-[#1a0000] border border-[#ff000033] rounded p-4 text-xs text-[#ff6666]">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="mt-6 bg-[#111] border border-[#1a1a1a] rounded p-4 text-xs text-[#444] space-y-1">
        <div className="text-[#555] font-bold mb-2 uppercase tracking-widest">How it works</div>
        <div>• Choose a term between 1 and 500 days</div>
        <div>• Longer terms earn higher amplifier multipliers</div>
        <div>• PURGE tokens are claimable after your term expires</div>
        <div>• No pre-mine. No admin keys. Fair launch.</div>
      </div>
    </div>
  );
};

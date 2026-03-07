'use client';

import { FC, useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Connection,
} from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('8g6XCgTdm5WnQmFRZYu4DMUCJyKU1JWxKmQ16KqweP2n');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';
const PURGE_MINT = new PublicKey('CYrMpw3kX92ZtGbLF9p7nQSYt7mj1J1WvDidtt5rpCyP');

function estimatePurge(days: number): string {
  // Rough estimate — actual uses XEN formula on-chain
  const base = days * 100;
  const amp = 1 + Math.log(days) * 0.5;
  return Math.floor(base * amp).toLocaleString();
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export const ClaimRank: FC = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [term, setTerm] = useState(30);
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingMint, setExistingMint] = useState<{ termDays: number; matureTs: number; claimed: boolean } | null>(null);
  const [checkingRank, setCheckingRank] = useState(false);

  const getUserMintPDA = useCallback((userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_mint'), userPubkey.toBuffer()],
      PROGRAM_ID
    );
  }, []);

  // Check existing user_mint PDA
  useEffect(() => {
    if (!publicKey) { setExistingMint(null); return; }
    const check = async () => {
      setCheckingRank(true);
      try {
        const conn = new Connection(X1_RPC, 'confirmed');
        const [pda] = getUserMintPDA(publicKey);
        const info = await conn.getAccountInfo(pda);
        if (info && info.data.length >= 8 + 32 + 8 + 8 + 1 + 8 + 8 + 1) {
          // Layout: 8 disc + 32 owner + 8 term_days + 8 mature_ts + 1 claimed + 8 rank + 8 reward + 1 bump
          const data = info.data as Buffer;
          const termDays = Number(data.readBigUInt64LE(8 + 32));
          const matureTs = Number(data.readBigInt64LE(8 + 32 + 8));
          const claimed = data[8 + 32 + 8 + 8] === 1;
          setExistingMint({ termDays, matureTs, claimed });
        } else {
          setExistingMint(null);
        }
      } catch {
        setExistingMint(null);
      } finally {
        setCheckingRank(false);
      }
    };
    check();
  }, [publicKey, getUserMintPDA, txSig]);

  const hasActiveMint = existingMint !== null &&
    !existingMint.claimed &&
    Date.now() / 1000 < existingMint.matureTs;

  const handleClaim = useCallback(async () => {
    if (!connected || !publicKey || !sendTransaction) return;
    setLoading(true);
    setError(null);
    setTxSig(null);

    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const [userMintPDA] = getUserMintPDA(publicKey);
      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')], PROGRAM_ID
      );

      // Anchor discriminator for "claim_rank" in module "purge"
      const encoded = new TextEncoder().encode('global:claim_rank');
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

      // Args: term_days as u64 LE
      const termBuf = new Uint8Array(8);
      let val = term;
      for (let i = 0; i < 8; i++) { termBuf[i] = val & 0xff; val = Math.floor(val / 256); }

      const data = Buffer.from(new Uint8Array([...discriminator, ...termBuf]));

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: userMintPDA, isSigner: false, isWritable: true },
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

      const sig = await sendTransaction(tx, conn, { skipPreflight: false, preflightCommitment: 'confirmed' });
      await conn.confirmTransaction(sig, 'confirmed');
      setTxSig(sig);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('ActiveMintExists')) {
        setError('You already have an active mint. Claim your reward first.');
      } else if (msg.includes('InvalidTerm')) {
        setError('Invalid term. Choose between 1 and 500 days.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, sendTransaction, term, getUserMintPDA]);

  const amplifier = parseFloat((1 + Math.log(term) * 0.5).toFixed(2));
  const maturityDate = new Date(Date.now() + term * 86400000);

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">MINT</h1>
        <p className="text-[#555] text-sm">
          Lock your term. Amplify your rewards. Mint PURGE tokens on X1.
        </p>
      </div>

      {connected && publicKey && (
        <div className="mb-6 flex items-center gap-2 text-xs text-[#555] bg-[#111] border border-[#1a1a1a] rounded px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-[#00FFAA] inline-block"></span>
          <span className="font-mono">{shortenAddress(publicKey.toBase58())}</span>
          <span className="ml-auto text-[#00FFAA]">Connected</span>
          {checkingRank && <span className="text-[#555] ml-2">Checking...</span>}
          {!checkingRank && hasActiveMint && (
            <span className="text-yellow-400 ml-2">⚠ Active mint</span>
          )}
          {!checkingRank && existingMint?.claimed && (
            <span className="text-[#555] ml-2">◆ Claimed</span>
          )}
        </div>
      )}

      <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 space-y-6 glow">

        {/* Term Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-bold tracking-widest text-[#888] uppercase">Term Length</label>
            <span className="text-[#00FFAA] font-black text-lg">{term} <span className="text-sm font-normal text-[#555]">days</span></span>
          </div>
          <input
            type="range" min={1} max={500} value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-[#444] mt-1">
            <span>1 day</span><span>250 days</span><span>500 days</span>
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
            <div className="text-2xl font-black text-white">{estimatePurge(term)}</div>
            <div className="text-xs text-[#444] mt-1">tokens</div>
          </div>
        </div>

        {/* Maturity info */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-[#555]">Maturity date</span>
            <span className="font-mono text-[#888]">
              {maturityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#555]">PURGE Mint</span>
            <a
              href={`https://explorer.mainnet.x1.xyz/address/${PURGE_MINT.toBase58()}`}
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[#00FFAA] text-xs hover:underline"
            >
              {PURGE_MINT.toBase58().slice(0, 8)}...
            </a>
          </div>
        </div>

        {/* Action */}
        {!connected ? (
          <div className="text-center space-y-3">
            <p className="text-[#555] text-sm">Connect your wallet to claim rank</p>
            <WalletMultiButton />
          </div>
        ) : hasActiveMint ? (
          <div className="w-full py-4 bg-[#1a1a00] border border-yellow-700 text-yellow-400 font-black text-sm tracking-widest rounded text-center uppercase">
            ⚠ Active Mint — Claim Reward First
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full py-4 bg-[#00FFAA] text-black font-black text-sm tracking-widest rounded
              hover:bg-[#00cc88] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                Sending Transaction...
              </span>
            ) : `⚡ Claim Rank — ${term} Days`}
          </button>
        )}

        {txSig && (
          <div className="bg-[#001a0d] border border-[#00FFAA33] rounded p-4 text-xs space-y-2">
            <div className="text-[#00FFAA] font-bold">✓ Rank Claimed Successfully</div>
            <a
              href={`https://explorer.mainnet.x1.xyz/tx/${txSig}`}
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[#00FFAA] break-all hover:underline"
            >{txSig}</a>
            <div className="text-[#444] pt-1">
              Come back on{' '}
              <span className="text-white">
                {maturityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>{' '}
              to claim your PURGE tokens.
            </div>
          </div>
        )}

        {error && (
          <div className="bg-[#1a0000] border border-[#ff000033] rounded p-4 text-xs text-[#ff6666]">
            ⚠ {error}
          </div>
        )}
      </div>

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

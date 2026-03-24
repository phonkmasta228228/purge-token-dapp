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
  SendOptions,
} from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('6K6md8GFmT8fncNbWqHSJrduYfG6HgnFCp34jdouGVSM');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';
const PURGE_MINT = new PublicKey('6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP');
const MAX_MINT_SLOTS = 2500000;

const AMP_START = 69;
const SLOTS_PER_TX = 5;

/** Derive current AMP from genesis timestamp (decays 1/day, floors at 0) */
function computeAmp(genesisTs: bigint): number {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const daysPassed = Number((now - genesisTs) / 86400n);
  return Math.max(0, AMP_START - daysPassed);
}

function estimatePurge(days: number, amp: number): string {
  return (amp * days).toLocaleString();
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

interface CounterData {
  totalMinted: number;
  activeCount: number;
  nextSlot: number;
}

interface BatchResult {
  slot: number;
  success: boolean;
  sig?: string;
  error?: string;
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

async function getDiscriminator(name: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(name);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(hashBuffer).slice(0, 8);
}

function encodeU64LE(val: number): Uint8Array {
  const buf = new Uint8Array(8);
  let v = val;
  for (let i = 0; i < 8; i++) { buf[i] = v & 0xff; v = Math.floor(v / 256); }
  return buf;
}

export const ClaimRank: FC = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [term, setTerm] = useState(30);
  const [slotsPerTx, setSlotsPerTx] = useState(SLOTS_PER_TX);
  // batchCount is always equal to slotsPerTx — one tx, however many mints they chose
  const batchCount = slotsPerTx;
  const [loading, setLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [counter, setCounter] = useState<CounterData | null>(null);
  const [checkingCounter, setCheckingCounter] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; succeeded: number; failed: number } | null>(null);
  const [currentAmp, setCurrentAmp] = useState<number | null>(null);
  const [ampLoading, setAmpLoading] = useState(true);

  const loadCounter = useCallback(async (pubkey: PublicKey) => {
    setCheckingCounter(true);
    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const [pda] = getUserCounterPDA(pubkey);
      const info = await conn.getAccountInfo(pda);
      if (info && info.data.length >= 8 + 4 + 4 + 1) {
        const data = info.data as Buffer;
        // UserCounter: 8 disc | 4 next_slot_index (u32) | 4 active_mints (u32) | 1 bump
        let offset = 8;
        const nextSlot = data.readUInt32LE(offset); offset += 4;
        const activeCount = data.readUInt32LE(offset);
        setCounter({ totalMinted: nextSlot, activeCount, nextSlot });
      } else {
        setCounter({ totalMinted: 0, activeCount: 0, nextSlot: 0 });
      }
    } catch {
      setCounter(null);
    } finally {
      setCheckingCounter(false);
    }
  }, []);

  useEffect(() => {
    if (!publicKey) { setCounter(null); return; }
    loadCounter(publicKey);
  }, [publicKey, loadCounter]);

  // Fetch live AMP from global_state on mount (doesn't require wallet)
  useEffect(() => {
    let cancelled = false;
    async function fetchAmp() {
      setAmpLoading(true);
      try {
        const conn = new Connection(X1_RPC, 'confirmed');
        const [globalStatePDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('global_state')], PROGRAM_ID
        );
        const info = await conn.getAccountInfo(globalStatePDA);
        if (!info || !info.data || info.data.length < 8 + 8 + 8 + 8 + 8) {
          if (!cancelled) setCurrentAmp(AMP_START); // fallback
          return;
        }
        const data = info.data as Buffer;
        // GlobalState layout: 8 disc | u64 total_minters | u64 _reserved | u64 active_mints | i64 genesis_ts | u8 bump
        const genesisTs = data.readBigInt64LE(8 + 8 + 8 + 8);
        if (!cancelled) setCurrentAmp(computeAmp(BigInt(genesisTs)));
      } catch {
        if (!cancelled) setCurrentAmp(AMP_START); // fallback to hardcoded if RPC fails
      } finally {
        if (!cancelled) setAmpLoading(false);
      }
    }
    fetchAmp();
    return () => { cancelled = true; };
  }, []);

  const atLimit = counter !== null && counter.activeCount >= MAX_MINT_SLOTS;
  const slotsRemaining = counter !== null ? MAX_MINT_SLOTS - counter.activeCount : MAX_MINT_SLOTS;

  const buildClaimTx = useCallback((
    slots: number[],
    counterPDA: PublicKey,
    globalStatePDA: PublicKey,
    discriminator: Uint8Array,
    blockhash: string,
  ): Transaction => {
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = publicKey!;

    for (const slotId of slots) {
      const termBuf = encodeU64LE(term);
      const slotBuf = new Uint8Array(4);
      new DataView(slotBuf.buffer).setUint32(0, slotId, true);
      const ixData = Buffer.from(new Uint8Array([...discriminator, ...termBuf, ...slotBuf]));
      const [userMintPDA] = getUserMintPDA(publicKey!, slotId);

      tx.add(new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: counterPDA,              isSigner: false, isWritable: true },
          { pubkey: userMintPDA,             isSigner: false, isWritable: true },
          { pubkey: globalStatePDA,          isSigner: false, isWritable: true },
          { pubkey: publicKey!,              isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixData,
      }));
    }
    return tx;
  }, [publicKey, term]);

  const handleBatchClaim = useCallback(async () => {
    if (!connected || !publicKey || !sendTransaction) return;
    setLoading(true);
    setError(null);
    setBatchResults([]);
    setProgress(null);

    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const discriminator = await getDiscriminator('global:claim_rank');

      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')], PROGRAM_ID
      );
      const [counterPDA] = getUserCounterPDA(publicKey);
      const counterInfo = await conn.getAccountInfo(counterPDA);
      let startSlot = 0;
      let currentActiveCount = 0;
      if (counterInfo && counterInfo.data.length >= 8 + 4 + 4 + 1) {
        const d = counterInfo.data as Buffer;
        // UserCounter: 8 disc | 4 next_slot_index (u32) | 4 active_mints (u32) | 1 bump
        startSlot = d.readUInt32LE(8);
        currentActiveCount = d.readUInt32LE(12);
      }

      const available = MAX_MINT_SLOTS - currentActiveCount;
      const actualBatch = Math.min(batchCount, available);
      if (actualBatch <= 0) {
        setError('No slots available — claim existing rewards first.');
        setLoading(false);
        return;
      }

      const txSlotGroups: number[][] = [];
      for (let i = 0; i < actualBatch; i += slotsPerTx) {
        txSlotGroups.push(
          Array.from({ length: Math.min(slotsPerTx, actualBatch - i) }, (_, j) => startSlot + i + j)
        );
      }

      const allResults: BatchResult[] = [];
      const sendOpts: SendOptions = { skipPreflight: false, preflightCommitment: 'confirmed' };

      for (const slots of txSlotGroups) {
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
        const tx = buildClaimTx(slots, counterPDA, globalStatePDA, discriminator, blockhash);
        try {
          const sig = await sendTransaction(tx, conn, sendOpts);
          await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
          slots.forEach(slotId => allResults.push({ slot: slotId, success: true, sig }));
        } catch (e: unknown) {
          const msg = (e instanceof Error ? e.message : String(e));
          const msgLower = msg.toLowerCase();
          console.log('[ClaimRank] Transaction error:', msg);
          // If user rejected, abort the entire batch immediately — no more prompts
          if (msgLower.includes('user rejected') || msgLower.includes('rejected') || msgLower.includes('transaction cancelled') || msgLower.includes('cancelled') || msgLower.includes('closed') || msgLower.includes('timeout') || msgLower.includes('user denied') || msgLower.includes('denied') || msgLower.includes('abort') || msgLower.includes('dismiss') || msgLower.includes('popup')) {
            setBatchResults([...allResults]);
            setProgress({ sent: allResults.length, succeeded: allResults.filter(r => r.success).length, failed: allResults.filter(r => !r.success).length });
            return;
          }
          slots.forEach(slotId => allResults.push({ slot: slotId, success: false, error: msg }));
        }

        setProgress({
          sent: allResults.length,
          succeeded: allResults.filter(r => r.success).length,
          failed: allResults.filter(r => !r.success).length,
        });
        setBatchResults([...allResults]);
      }

      await loadCounter(publicKey);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, sendTransaction, buildClaimTx, term, batchCount, slotsPerTx, loadCounter]);

  const maturityDate = new Date(Date.now() + term * 86400000);
  const successCount = batchResults.filter(r => r.success).length;
  const totalTxs = Math.ceil(batchCount / slotsPerTx);

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">MINT</h1>
        <p className="text-[#555] text-sm">
          Lock your term. Amplify your rewards. Mint PURGE tokens on X1.
        </p>
      </div>

      {connected && publicKey && (
        <div className="mb-4 flex items-center gap-2 text-xs text-[#555] bg-[#111] border border-[#1a1a1a] rounded px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-[#00FFAA] inline-block"></span>
          <span className="font-mono">{shortenAddress(publicKey.toBase58())}</span>
          <span className="ml-auto text-[#00FFAA]">Connected</span>
          {checkingCounter && <span className="text-[#555] ml-2">Checking...</span>}
          {!checkingCounter && counter !== null && (
            <span className={`ml-2 ${atLimit ? 'text-red-400' : 'text-[#555]'}`}>
              {counter.activeCount}/{MAX_MINT_SLOTS} active
            </span>
          )}
        </div>
      )}

      {atLimit && (
        <div className="mb-4 bg-[#1a0000] border border-red-800 text-red-400 rounded px-4 py-3 text-xs font-bold tracking-widest uppercase">
          ⚠ Max Mints Reached (2,500,000/2,500,000) — Claim existing rewards to free slots
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
            type="range" min={1} max={100} value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full"
            disabled={loading}
          />
          <div className="flex justify-between text-xs text-[#444] mt-1">
            <span>1 day</span><span>50 days</span><span>100 days</span>
          </div>
        </div>

        {/* Mints per Transaction */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-bold tracking-widest text-[#888] uppercase">Mints per Tx</label>
            <span className="text-[#00FFAA] font-black text-lg">{slotsPerTx} <span className="text-sm font-normal text-[#555]">mint{slotsPerTx > 1 ? 's' : ''}</span></span>
          </div>
          <input
            type="range" min={1} max={16} value={slotsPerTx}
            onChange={(e) => setSlotsPerTx(Number(e.target.value))}
            className="w-full"
            disabled={loading}
          />
          <div className="flex justify-between text-xs text-[#444] mt-1">
            <span>1</span><span>4</span><span>8</span><span>12</span><span>16</span>
          </div>
        </div>

        {/* Stats + Cost */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-3 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">AMP</div>
            <div className={`text-2xl font-black text-[#00FFAA] ${ampLoading ? 'animate-pulse opacity-40' : ''}`}>
              {ampLoading ? '…' : currentAmp}
            </div>
            <div className="text-xs text-[#444] mt-1">live · decays 1/day</div>
          </div>
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-3 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Est. PURGE</div>
            <div className={`text-xl font-black text-white ${ampLoading ? 'animate-pulse opacity-40' : ''}`}>
              {ampLoading ? '…' : ((currentAmp ?? 0) * term * slotsPerTx).toLocaleString()}
            </div>
            <div className="text-xs text-[#444] mt-1">{slotsPerTx > 1 ? `${slotsPerTx} mints total` : 'per mint'}</div>
          </div>
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-3 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Est. Cost</div>
            <div className="text-xl font-black text-[#88aaff]">
              {(slotsPerTx * 0.00203).toFixed(4)}
            </div>
            <div className="text-xs text-[#444] mt-1">XNT rent</div>
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
          {counter !== null && counter.totalMinted > 0 && (
            <div className="flex justify-between">
              <span className="text-[#555]">Lifetime mints</span>
              <span className="font-mono text-[#888]">{counter.totalMinted}</span>
            </div>
          )}
        </div>

        {/* Action */}
        {!connected ? (
          <div className="text-center space-y-3">
            <p className="text-[#555] text-sm">Connect your wallet to claim rank</p>
            <WalletMultiButton />
          </div>
        ) : atLimit ? (
          <div className="w-full py-4 bg-[#1a0000] border border-red-800 text-red-400 font-black text-sm tracking-widest rounded text-center uppercase">
            ⚠ 2,500,000/2,500,000 — Claim rewards to free slots
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleBatchClaim}
              disabled={loading}
              className="w-full py-4 bg-[#00FFAA] text-black font-black text-sm tracking-widest rounded
                hover:bg-[#00cc88] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                  {progress
                    ? `${progress.succeeded}/${progress.sent} confirmed...`
                    : `Preparing ${totalTxs} tx${totalTxs > 1 ? 's' : ''}...`}
                </span>
              ) : slotsPerTx > 1
                ? `⚡ Mint × ${slotsPerTx} — ${term} Days — 1 Approval`
                : `⚡ Claim Rank — ${term} Days`}
            </button>
            {loading && progress && (
              <div className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded h-2 overflow-hidden">
                <div
                  className="h-full bg-[#00FFAA] transition-all duration-300"
                  style={{ width: `${(progress.sent / batchCount) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Batch Results */}
        {batchResults.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-[#555] uppercase tracking-widest font-bold">
              Results — {successCount}/{batchResults.length} succeeded
            </div>
            <div className="grid grid-cols-1 gap-2">
              {batchResults.map((r) => (
                <div
                  key={r.slot}
                  className={`rounded px-3 py-2 text-xs ${
                    r.success
                      ? 'bg-[#001a0d] border border-[#00FFAA33] text-[#00FFAA]'
                      : 'bg-[#1a0000] border border-[#ff000033] text-[#ff6666]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Slot #{r.slot} — {r.success ? '✓ Success' : '✗ Failed'}</span>
                    {r.success && r.sig && (
                      <a
                        href={`https://explorer.mainnet.x1.xyz/tx/${r.sig}`}
                        target="_blank" rel="noopener noreferrer"
                        className="font-mono text-[#00FFAA] hover:underline ml-2"
                      >
                        {r.sig.slice(0, 8)}...
                      </a>
                    )}
                  </div>
                  {!r.success && r.error && (
                    <div className="mt-1 text-[#ff6666] truncate">{r.error}</div>
                  )}
                </div>
              ))}
            </div>
            {successCount > 0 && (
              <div className="text-xs text-[#444] pt-1">
                Come back on{' '}
                <span className="text-white">
                  {maturityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>{' '}
                to claim your PURGE tokens.
              </div>
            )}
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
        <div>• Choose a term between 1 and 100 days</div>
        <div>• Use batch mint to claim multiple mints — up to 16 per wallet signature (fewer pop-ups)</div>
        <div>• Reward = AMP × term days (AMP decays by 1 per day from genesis, floors at 0)</div>
        <div>• Current AMP is fetched live from the on-chain global_state account</div>
        <div>• PURGE tokens are claimable after each term expires</div>
        <div>• No pre-mine. No admin keys. Fair launch.</div>
      </div>

      <div className="mt-4 bg-[#0d1a0d] border border-[#00FFAA33] rounded p-4 text-xs text-[#00FFAA] space-y-1">
        <div className="font-bold uppercase tracking-widest mb-2">⏰ 14-Day Claim Window</div>
        <div className="text-[#888]">
          Once your mint matures, you have <span className="text-[#00FFAA] font-bold">14 days</span> to claim your PURGE reward penalty-free.
          After that window closes, the slot becomes uncollectable. Don&apos;t let it expire.
        </div>
      </div>
    </div>
  );
};

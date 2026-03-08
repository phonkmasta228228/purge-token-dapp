'use client';

import { FC, useState, useCallback, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Connection,
} from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('6K6md8GFmT8fncNbWqHSJrduYfG6HgnFCp34jdouGVSM');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';
const PURGE_MINT = new PublicKey('ENJrUxHe2tBy3SZp3AHp94Urra1Hs5eNyNWh9hJ8G7a5');
const MAX_MINT_SLOTS = 2500000;

// AMP starts at 69 on genesis day, decays by 1 per day, floors at 0.
// reward = AMP × term_days (displayed without 10^18 decimals factor)
const CURRENT_AMP = 69;

function estimatePurge(days: number, amp: number = CURRENT_AMP): string {
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
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_mint'), userPubkey.toBuffer(), Buffer.from([slotId])],
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

const CHUNK_SIZE = 50;          // txs per wave
const WAVE_GAP_MS = 300;        // ms pause between waves

export const ClaimRank: FC = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [term, setTerm] = useState(30);
  const [batchCount, setBatchCount] = useState(1);
  const [chunkSize, setChunkSize] = useState(CHUNK_SIZE);
  const [loading, setLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [counter, setCounter] = useState<CounterData | null>(null);
  const [checkingCounter, setCheckingCounter] = useState(false);
  const [waveStats, setWaveStats] = useState<{ sent: number; succeeded: number; failed: number; wave: number; totalWaves: number } | null>(null);
  const [tps, setTps] = useState<number | null>(null);
  const [peakTps, setPeakTps] = useState<number>(0);
  const abortRef = useRef(false);
  // Rolling TPS: timestamps of recent confirmations (last 5s)
  const confirmTimestamps = useRef<number[]>([]);

  const loadCounter = useCallback(async (pubkey: PublicKey) => {
    setCheckingCounter(true);
    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const [pda] = getUserCounterPDA(pubkey);
      const info = await conn.getAccountInfo(pda);
      if (info && info.data.length >= 8 + 32 + 8 + 1 + 1 + 1) {
        // Layout: 8 disc + 32 owner + 8 total_minted + 1 active_count + 1 next_slot + 1 bump
        const data = info.data as Buffer;
        let offset = 8 + 32;
        const totalMinted = Number(data.readBigUInt64LE(offset)); offset += 8;
        const activeCount = data[offset]; offset += 1;
        const nextSlot = data[offset];
        setCounter({ totalMinted, activeCount, nextSlot });
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

  // TPS ticker: recomputes every 500ms from rolling confirmation timestamps
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const window = 5000; // 5-second rolling window
      confirmTimestamps.current = confirmTimestamps.current.filter(t => now - t < window);
      const currentTps = confirmTimestamps.current.length / (window / 1000);
      setTps(currentTps);
      setPeakTps(prev => Math.max(prev, currentTps));
    }, 500);
    return () => clearInterval(interval);
  }, [loading]);

  const atLimit = counter !== null && counter.activeCount >= MAX_MINT_SLOTS;
  const slotsRemaining = counter !== null ? MAX_MINT_SLOTS - counter.activeCount : MAX_MINT_SLOTS;

  const handleBatchClaim = useCallback(async () => {
    if (!connected || !publicKey || !sendTransaction) return;
    setLoading(true);
    setError(null);
    setBatchResults([]);
    setWaveStats(null);
    setTps(null);
    setPeakTps(0);
    confirmTimestamps.current = [];
    abortRef.current = false;

    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const discriminator = await getDiscriminator('global:claim_rank');
      const termBuf = encodeU64LE(term);
      const data = Buffer.from(new Uint8Array([...discriminator, ...termBuf]));

      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')], PROGRAM_ID
      );

      // Re-read counter to get current next_slot
      const [counterPDA] = getUserCounterPDA(publicKey);
      const counterInfo = await conn.getAccountInfo(counterPDA);
      let startSlot = 0;
      let currentActiveCount = 0;
      if (counterInfo && counterInfo.data.length >= 8 + 32 + 8 + 1 + 1 + 1) {
        const d = counterInfo.data as Buffer;
        let off = 8 + 32 + 8;
        currentActiveCount = d[off]; off += 1;
        startSlot = d[off];
      }

      // Clamp batch to available slots
      const available = MAX_MINT_SLOTS - currentActiveCount;
      const actualBatch = Math.min(batchCount, available);

      if (actualBatch <= 0) {
        setError('No slots available — claim existing rewards first.');
        setLoading(false);
        return;
      }

      // Chunked wave dispatch — fire chunkSize txs at a time, pause between waves
      abortRef.current = false;
      const totalWaves = Math.ceil(actualBatch / chunkSize);
      const allResults: BatchResult[] = [];

      for (let wave = 0; wave < totalWaves; wave++) {
        if (abortRef.current) break;

        const waveStart = wave * chunkSize;
        const waveEnd = Math.min(waveStart + chunkSize, actualBatch);
        const waveSize = waveEnd - waveStart;

        // Refresh blockhash each wave so txs don't expire
        const { blockhash } = await conn.getLatestBlockhash('confirmed');

        const wavePromises = Array.from({ length: waveSize }, async (_, j) => {
          const slotId = startSlot + waveStart + j;
          const [userMintPDA] = getUserMintPDA(publicKey, slotId);

          const ix = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
              { pubkey: counterPDA, isSigner: false, isWritable: true },
              { pubkey: userMintPDA, isSigner: false, isWritable: true },
              { pubkey: globalStatePDA, isSigner: false, isWritable: true },
              { pubkey: publicKey, isSigner: true, isWritable: true },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data,
          });

          const tx = new Transaction();
          tx.recentBlockhash = blockhash;
          tx.feePayer = publicKey;
          tx.add(ix);

          try {
            const sig = await sendTransaction(tx, conn, { skipPreflight: false, preflightCommitment: 'confirmed' });
            await conn.confirmTransaction(sig, 'confirmed');
            confirmTimestamps.current.push(Date.now());
            return { slot: slotId, success: true, sig } as BatchResult;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { slot: slotId, success: false, error: msg } as BatchResult;
          }
        });

        const waveSettled = await Promise.allSettled(wavePromises);
        const waveResults: BatchResult[] = waveSettled.map((r, j) => {
          if (r.status === 'fulfilled') return r.value;
          return { slot: startSlot + waveStart + j, success: false, error: String(r.reason) };
        });

        allResults.push(...waveResults);

        // Update UI progressively after each wave
        const sent = allResults.length;
        const succeeded = allResults.filter(r => r.success).length;
        const failed = sent - succeeded;
        setWaveStats({ sent, succeeded, failed, wave: wave + 1, totalWaves });
        setBatchResults([...allResults]);

        // Gap between waves (skip after last wave)
        if (wave < totalWaves - 1 && !abortRef.current) {
          await new Promise(res => setTimeout(res, WAVE_GAP_MS));
        }
      }

      // Refresh counter
      await loadCounter(publicKey);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, sendTransaction, term, batchCount, chunkSize, loadCounter]);

  const maturityDate = new Date(Date.now() + term * 86400000);
  const successCount = batchResults.filter(r => r.success).length;

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

      {/* Limit Warning */}
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
          />
          <div className="flex justify-between text-xs text-[#444] mt-1">
            <span>1 day</span><span>50 days</span><span>100 days</span>
          </div>
        </div>

        {/* Batch Count */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-bold tracking-widest text-[#888] uppercase">Batch Count</label>
            <span className="text-[#00FFAA] font-black text-lg">{batchCount} <span className="text-sm font-normal text-[#555]">mint{batchCount > 1 ? 's' : ''}</span></span>
          </div>
          <input
            type="range" min={1} max={2500000} value={batchCount}
            onChange={(e) => setBatchCount(Number(e.target.value))}
            className="w-full"
            disabled={atLimit}
          />
          <div className="flex justify-between text-xs text-[#444] mt-1">
            <span>1</span><span>5</span><span>10</span>
          </div>
          {counter !== null && (
            <div className="text-xs text-[#555] mt-1 text-right">
              {slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} available
            </div>
          )}
        </div>

        {/* Wave / Chunk Size */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-bold tracking-widest text-[#888] uppercase">Wave Size</label>
            <span className="text-[#00FFAA] font-black text-lg">{chunkSize} <span className="text-sm font-normal text-[#555]">txs / wave</span></span>
          </div>
          <input
            type="range" min={1} max={200} value={chunkSize}
            onChange={(e) => setChunkSize(Number(e.target.value))}
            className="w-full"
            disabled={loading}
          />
          <div className="flex justify-between text-xs text-[#444] mt-1">
            <span>1 (safe)</span><span>50 (default)</span><span>200 (aggressive)</span>
          </div>
          <div className="text-xs text-[#444] mt-1">
            Higher = more pressure per burst. Lower = gentler, fewer RPC drops.
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">AMP</div>
            <div className="text-2xl font-black text-[#00FFAA]">{CURRENT_AMP}</div>
            <div className="text-xs text-[#444] mt-1">decays 1/day from genesis</div>
          </div>
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-4 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Est. PURGE / mint</div>
            <div className="text-2xl font-black text-white">{estimatePurge(term)}</div>
            <div className="text-xs text-[#444] mt-1">AMP × days</div>
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
                  {waveStats
                    ? `Wave ${waveStats.wave}/${waveStats.totalWaves} — ${waveStats.sent} sent · ${waveStats.succeeded} ✓ · ${waveStats.failed} ✗`
                    : `Preparing ${batchCount} tx${batchCount > 1 ? 's' : ''}...`}
                </span>
              ) : batchCount > 1
                ? `⚡ Batch Mint × ${batchCount} — ${term} Days`
                : `⚡ Claim Rank — ${term} Days`}
            </button>
            {loading && (
              <button
                onClick={() => { abortRef.current = true; }}
                className="w-full py-2 bg-transparent border border-red-800 text-red-400 font-bold text-xs tracking-widest rounded hover:bg-[#1a0000] uppercase"
              >
                ✕ Abort After Current Wave
              </button>
            )}
            {loading && waveStats && (
              <div className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded h-2 overflow-hidden">
                <div
                  className="h-full bg-[#00FFAA] transition-all duration-300"
                  style={{ width: `${(waveStats.sent / batchCount) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* TPS Gauge */}
        {(loading || (tps !== null && batchResults.length > 0)) && (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
            <div className="text-xs text-[#555] uppercase tracking-widest font-bold mb-3">Live TPS</div>
            <div className="flex items-end gap-6">
              <div className="text-center">
                <div className="text-3xl font-black text-[#00FFAA] tabular-nums">
                  {tps !== null ? tps.toFixed(1) : '—'}
                </div>
                <div className="text-xs text-[#555] mt-1">confirmed / sec</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-white tabular-nums">
                  {peakTps > 0 ? peakTps.toFixed(1) : '—'}
                </div>
                <div className="text-xs text-[#555] mt-1">peak TPS</div>
              </div>
              <div className="flex-1">
                {/* TPS bar relative to peak */}
                <div className="w-full bg-[#111] border border-[#222] rounded h-6 overflow-hidden">
                  <div
                    className="h-full bg-[#00FFAA] transition-all duration-500"
                    style={{ width: peakTps > 0 && tps !== null ? `${Math.min((tps / peakTps) * 100, 100)}%` : '0%' }}
                  />
                </div>
                <div className="text-xs text-[#444] mt-1 text-right">5s rolling window</div>
              </div>
            </div>
          </div>
        )}

        {/* Batch Results Grid */}
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
        <div>• Use batch mint to fire up to 2,500,000 mints at once (max 2,500,000 active per wallet)</div>
        <div>• Reward = AMP × term days (AMP starts at 69, decays by 1 per day, floors at 0)</div>
        <div>• PURGE tokens are claimable after each term expires</div>
        <div>• No pre-mine. No admin keys. Fair launch.</div>
      </div>
    </div>
  );
};

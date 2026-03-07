'use client';

import { FC, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// XEN-style amplifier: logarithmic growth, longer term = higher multiplier
function getAmplifier(days: number): number {
  if (days <= 1) return 1.0;
  return parseFloat((1 + Math.log(days) * 0.5).toFixed(2));
}

// Estimated PURGE tokens based on days + amplifier
function estimatePurge(days: number): number {
  const base = days * 100;
  const amp = getAmplifier(days);
  return Math.floor(base * amp);
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export const ClaimRank: FC = () => {
  const { connected, publicKey } = useWallet();
  const [term, setTerm] = useState(30);
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amplifier = getAmplifier(term);
  const estimated = estimatePurge(term);

  const handleClaim = useCallback(async () => {
    if (!connected || !publicKey) return;
    setLoading(true);
    setError(null);
    setTxSig(null);

    try {
      // Stub: simulate a delay and return a mock tx signature
      await new Promise((r) => setTimeout(r, 1500));
      const mockSig = Array.from({ length: 64 }, () =>
        '0123456789abcdef'[Math.floor(Math.random() * 16)]
      ).join('');
      setTxSig(mockSig);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey]);

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
                Processing...
              </span>
            ) : (
              `⚡ Claim Rank — ${term} Days`
            )}
          </button>
        )}

        {/* Success */}
        {txSig && (
          <div className="bg-[#001a0d] border border-[#00FFAA33] rounded p-4 text-xs space-y-1">
            <div className="text-[#00FFAA] font-bold">✓ Rank Claimed Successfully</div>
            <div className="text-[#555]">Transaction:</div>
            <div className="font-mono text-[#444] break-all">{txSig}</div>
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

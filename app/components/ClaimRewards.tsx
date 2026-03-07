'use client';

import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

type ClaimStatus = 'pending' | 'mature' | 'claimed';

interface Claim {
  id: string;
  term: number;
  startDate: Date;
  maturityDate: Date;
  amount: number;
  status: ClaimStatus;
}

// Mock claims data
const MOCK_CLAIMS: Claim[] = [
  {
    id: 'a1b2c3',
    term: 90,
    startDate: new Date(Date.now() - 95 * 86400000),
    maturityDate: new Date(Date.now() - 5 * 86400000),
    amount: 137842,
    status: 'mature',
  },
  {
    id: 'd4e5f6',
    term: 180,
    startDate: new Date(Date.now() - 60 * 86400000),
    maturityDate: new Date(Date.now() + 120 * 86400000),
    amount: 312400,
    status: 'pending',
  },
  {
    id: 'g7h8i9',
    term: 30,
    startDate: new Date(Date.now() - 45 * 86400000),
    maturityDate: new Date(Date.now() - 15 * 86400000),
    amount: 43200,
    status: 'claimed',
  },
  {
    id: 'j0k1l2',
    term: 365,
    startDate: new Date(Date.now() - 10 * 86400000),
    maturityDate: new Date(Date.now() + 355 * 86400000),
    amount: 874500,
    status: 'pending',
  },
];

function getCountdown(maturityDate: Date): string {
  const diff = maturityDate.getTime() - Date.now();
  if (diff <= 0) return 'Ready';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

function statusColor(status: ClaimStatus): string {
  switch (status) {
    case 'pending': return 'text-[#ffaa00] bg-[#1a1000]';
    case 'mature': return 'text-[#00FFAA] bg-[#001a0d]';
    case 'claimed': return 'text-[#555] bg-[#111]';
  }
}

function statusLabel(status: ClaimStatus): string {
  switch (status) {
    case 'pending': return '⏳ Pending';
    case 'mature': return '✓ Mature';
    case 'claimed': return '◆ Claimed';
  }
}

export const ClaimRewards: FC = () => {
  const { connected } = useWallet();
  const [claims, setClaims] = useState<Claim[]>(MOCK_CLAIMS);
  const [claiming, setClaming] = useState<string | null>(null);

  const handleClaim = async (id: string) => {
    setClaming(id);
    await new Promise((r) => setTimeout(r, 1500));
    setClaims((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'claimed' as ClaimStatus } : c))
    );
    setClaming(null);
  };

  const matureClaims = claims.filter((c) => c.status === 'mature');
  const totalClaimable = matureClaims.reduce((sum, c) => sum + c.amount, 0);

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-xl font-black text-[#00FFAA] tracking-widest mb-2">CLAIM REWARDS</h2>
        <p className="text-[#555] mb-6 text-sm">Connect your wallet to view your active claims</p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">CLAIM REWARDS</h1>
        <p className="text-[#555] text-sm">Your active PURGE claims and maturity status.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#111] border border-[#1a1a1a] rounded p-4 text-center">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Total Claims</div>
          <div className="text-2xl font-black text-white">{claims.length}</div>
        </div>
        <div className="bg-[#111] border border-[#1a1a1a] rounded p-4 text-center">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Ready</div>
          <div className="text-2xl font-black text-[#00FFAA]">{matureClaims.length}</div>
        </div>
        <div className="bg-[#111] border border-[#1a1a1a] rounded p-4 text-center">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Claimable</div>
          <div className="text-lg font-black text-white">{totalClaimable.toLocaleString()}</div>
          <div className="text-xs text-[#555]">PURGE</div>
        </div>
      </div>

      {/* Claims table */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a1a1a]">
          <span className="text-xs font-bold tracking-widest text-[#555] uppercase">Active Claims</span>
        </div>

        {/* Desktop table headers */}
        <div className="hidden sm:grid grid-cols-5 px-4 py-2 text-xs text-[#444] uppercase tracking-widest border-b border-[#0d0d0d]">
          <div>Term</div>
          <div>Amount</div>
          <div>Status</div>
          <div>Countdown</div>
          <div className="text-right">Action</div>
        </div>

        <div className="divide-y divide-[#0d0d0d]">
          {claims.map((claim) => (
            <div key={claim.id} className="px-4 py-4">
              {/* Mobile layout */}
              <div className="sm:hidden space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold">{claim.term} days</span>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${statusColor(claim.status)}`}>
                    {statusLabel(claim.status)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#888] font-mono">{claim.amount.toLocaleString()} PURGE</span>
                  <span className="text-[#444] text-xs">{getCountdown(claim.maturityDate)}</span>
                </div>
                {claim.status === 'mature' && (
                  <button
                    onClick={() => handleClaim(claim.id)}
                    disabled={claiming === claim.id}
                    className="w-full py-2 bg-[#00FFAA] text-black text-xs font-black rounded
                      hover:bg-[#00cc88] transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                  >
                    {claiming === claim.id ? 'Claiming...' : 'Claim'}
                  </button>
                )}
              </div>

              {/* Desktop layout */}
              <div className="hidden sm:grid grid-cols-5 items-center">
                <div>
                  <span className="text-white font-bold">{claim.term}d</span>
                  <div className="text-xs text-[#444] font-mono">#{claim.id}</div>
                </div>
                <div className="text-[#888] font-mono text-sm">{claim.amount.toLocaleString()}</div>
                <div>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${statusColor(claim.status)}`}>
                    {statusLabel(claim.status)}
                  </span>
                </div>
                <div className="text-xs text-[#555] font-mono">
                  {claim.status === 'claimed'
                    ? claim.maturityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : getCountdown(claim.maturityDate)
                  }
                </div>
                <div className="text-right">
                  {claim.status === 'mature' ? (
                    <button
                      onClick={() => handleClaim(claim.id)}
                      disabled={claiming === claim.id}
                      className="px-4 py-2 bg-[#00FFAA] text-black text-xs font-black rounded
                        hover:bg-[#00cc88] transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                    >
                      {claiming === claim.id ? '...' : 'Claim'}
                    </button>
                  ) : claim.status === 'claimed' ? (
                    <span className="text-xs text-[#333] font-mono">Done</span>
                  ) : (
                    <span className="text-xs text-[#333] font-mono">Locked</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="mt-4 text-xs text-[#333] text-center">
        Showing mock data — connect to X1 mainnet to load on-chain claims
      </div>
    </div>
  );
};

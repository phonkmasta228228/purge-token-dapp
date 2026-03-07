'use client';

import { FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

const StatCard: FC<StatCardProps> = ({ label, value, sub, accent }) => (
  <div className={`bg-[#111] border rounded-lg p-5 ${accent ? 'border-[#00FFAA33]' : 'border-[#1a1a1a]'}`}>
    <div className="text-xs uppercase tracking-widest text-[#555] mb-2">{label}</div>
    <div className={`text-2xl font-black ${accent ? 'text-[#00FFAA]' : 'text-white'}`}>{value}</div>
    {sub && <div className="text-xs text-[#444] mt-1">{sub}</div>}
  </div>
);

const GLOBAL_STATS = {
  totalSupply: '47,382,900',
  activeClaims: '12,847',
  holders: '3,241',
  burned: '2,614,500',
  totalMinted: '49,997,400',
  avgTerm: '127 days',
};

const USER_STATS = {
  totalClaimed: '181,042',
  activeClaims: 4,
  avgAmp: '1.84×',
  rank: '#842',
};

const RECENT_ACTIVITY = [
  { addr: '7xKf...4mNp', action: 'Claimed Rank', term: '180d', purge: '312,400', time: '2m ago' },
  { addr: 'Bq9R...7vLs', action: 'Claimed Rewards', term: '90d', purge: '137,842', time: '8m ago' },
  { addr: '3pYt...2wKj', action: 'Claimed Rank', term: '365d', purge: '874,500', time: '15m ago' },
  { addr: 'Xm1A...9cBn', action: 'Claimed Rewards', term: '30d', purge: '43,200', time: '22m ago' },
  { addr: 'Kd5L...1oQr', action: 'Claimed Rank', term: '250d', purge: '517,750', time: '31m ago' },
  { addr: '2sWv...8hFz', action: 'Claimed Rewards', term: '500d', purge: '1,294,000', time: '45m ago' },
  { addr: 'Pn3T...6gMk', action: 'Claimed Rank', term: '60d', purge: '82,800', time: '1h ago' },
];

// Simple bar chart using divs
const MiniBarChart: FC = () => {
  const data = [
    { label: 'Jan', value: 65 },
    { label: 'Feb', value: 78 },
    { label: 'Mar', value: 52 },
    { label: 'Apr', value: 89 },
    { label: 'May', value: 73 },
    { label: 'Jun', value: 94 },
    { label: 'Jul', value: 61 },
    { label: 'Aug', value: 87 },
  ];

  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-[#00FFAA33] rounded-sm transition-all duration-500 relative group"
            style={{ height: `${(d.value / max) * 100}%` }}
          >
            <div className="absolute inset-0 bg-[#00FFAA] opacity-0 group-hover:opacity-20 rounded-sm transition-opacity" />
            <div className="w-full h-[2px] bg-[#00FFAA] absolute top-0 rounded-t-sm" />
          </div>
          <span className="text-[9px] text-[#333]">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

export const Dashboard: FC = () => {
  const { connected, publicKey } = useWallet();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">DASHBOARD</h1>
        <p className="text-[#555] text-sm">Global protocol stats and your personal metrics.</p>
      </div>

      {/* Global Stats */}
      <section>
        <div className="text-xs font-bold tracking-widest text-[#444] uppercase mb-4">Global Protocol Stats</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Supply" value={GLOBAL_STATS.totalSupply} sub="PURGE minted" accent />
          <StatCard label="Active Claims" value={GLOBAL_STATS.activeClaims} sub="in progress" />
          <StatCard label="Holders" value={GLOBAL_STATS.holders} sub="unique wallets" />
          <StatCard label="Burned" value={GLOBAL_STATS.burned} sub="PURGE destroyed" />
        </div>
      </section>

      {/* Chart + Activity side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Mint Volume Chart */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold tracking-widest text-[#555] uppercase">Monthly Mint Volume</span>
            <span className="text-xs text-[#00FFAA] font-mono">PURGE</span>
          </div>
          <MiniBarChart />
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#1a1a1a] pt-4">
            <div>
              <div className="text-xs text-[#555]">Avg Term</div>
              <div className="text-sm font-bold text-white">{GLOBAL_STATS.avgTerm}</div>
            </div>
            <div>
              <div className="text-xs text-[#555]">Total Minted</div>
              <div className="text-sm font-bold text-white">{GLOBAL_STATS.totalMinted}</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-5">
          <div className="text-xs font-bold tracking-widest text-[#555] uppercase mb-4">Recent Activity</div>
          <div className="space-y-3">
            {RECENT_ACTIVITY.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#0d0d0d] last:border-0">
                <div className="w-2 h-2 rounded-full bg-[#00FFAA33] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-[#888]">{item.addr}</span>
                    <span className="text-xs text-[#444]">{item.time}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-xs text-[#555]">{item.action} · {item.term}</span>
                    <span className="text-xs text-[#00FFAA] font-mono">+{item.purge}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Personal Stats */}
      {connected && publicKey ? (
        <section>
          <div className="text-xs font-bold tracking-widest text-[#444] uppercase mb-4">Your Stats</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Earned" value={USER_STATS.totalClaimed} sub="PURGE" accent />
            <StatCard label="Active Claims" value={String(USER_STATS.activeClaims)} sub="in progress" />
            <StatCard label="Avg Amplifier" value={USER_STATS.avgAmp} sub="your multiplier" />
            <StatCard label="Global Rank" value={USER_STATS.rank} sub="by holdings" />
          </div>
        </section>
      ) : (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 text-center">
          <div className="text-[#444] text-sm mb-1">Connect wallet to view personal stats</div>
          <div className="text-xs text-[#333]">Your rank, total PURGE, and claim history will appear here</div>
        </div>
      )}

      {/* Protocol constants */}
      <section>
        <div className="text-xs font-bold tracking-widest text-[#444] uppercase mb-4">Protocol Constants</div>
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg divide-y divide-[#0d0d0d]">
          {[
            { label: 'Token Mint', value: process.env.NEXT_PUBLIC_TOKEN_MINT || 'CYrMpw3kX92ZtGbLF9p7nQSYt7mj1J1WvDidtt5rpCyP' },
            { label: 'Program ID', value: process.env.NEXT_PUBLIC_PROGRAM_ID || '8g6XCgTdm5WnQmFRZYu4DMUCJyKU1JWxKmQ16KqweP2n' },
            { label: 'Mint Authority', value: process.env.NEXT_PUBLIC_MINT_AUTHORITY || 'CQHziQSbKjuoVyEcqaDjxD2NNYcLD3fBX2vA6VD1FV4p' },
            { label: 'Network', value: 'X1 Mainnet' },
            { label: 'Max Term', value: '500 days' },
            { label: 'Max Amplifier', value: `${(1 + Math.log(500) * 0.5).toFixed(2)}×` },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-[#555] uppercase tracking-widest">{label}</span>
              <span className="text-xs font-mono text-[#888] break-all text-right max-w-[60%]">{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

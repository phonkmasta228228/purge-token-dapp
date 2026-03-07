'use client';

import { FC, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Connection } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('8g6XCgTdm5WnQmFRZYu4DMUCJyKU1JWxKmQ16KqweP2n');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';
const SECONDS_PER_DAY = 86400;
const GENESIS_BONUS = 3000n;
const MIN_AMP = 100n;

interface GlobalState {
  totalMinters: bigint;
  amp: bigint;
  totalSupply: bigint;
  genesisTs: bigint;
}

interface UserRank {
  cRank: bigint;
  term: bigint;
  maturityTs: bigint;
  active: boolean;
}

function parseGlobalState(data: Buffer): GlobalState {
  // 8 discriminator + u64 × 4 + u8 bump
  let offset = 8;
  const totalMinters = data.readBigUInt64LE(offset); offset += 8;
  const amp = data.readBigUInt64LE(offset); offset += 8;
  const totalSupply = data.readBigUInt64LE(offset); offset += 8;
  const genesisTs = data.readBigUInt64LE(offset);
  return { totalMinters, amp, totalSupply, genesisTs };
}

function parseUserRank(data: Buffer): UserRank {
  let offset = 8 + 32; // discriminator + owner pubkey
  const cRank = data.readBigUInt64LE(offset); offset += 8;
  const term = data.readBigUInt64LE(offset); offset += 8;
  const maturityTs = data.readBigUInt64LE(offset); offset += 8;
  const active = data[offset] === 1;
  return { cRank, term, maturityTs, active };
}

function formatLargeNum(n: bigint): string {
  const num = Number(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  loading?: boolean;
}

const StatCard: FC<StatCardProps> = ({ label, value, sub, accent, loading }) => (
  <div className={`bg-[#111] border rounded-lg p-5 ${accent ? 'border-[#00FFAA33]' : 'border-[#1a1a1a]'}`}>
    <div className="text-xs uppercase tracking-widest text-[#555] mb-2">{label}</div>
    <div className={`text-2xl font-black ${accent ? 'text-[#00FFAA]' : 'text-white'} ${loading ? 'opacity-30 animate-pulse' : ''}`}>
      {loading ? '—' : value}
    </div>
    {sub && <div className="text-xs text-[#444] mt-1">{sub}</div>}
  </div>
);

export const Dashboard: FC = () => {
  const { connected, publicKey } = useWallet();
  const [globalState, setGlobalState] = useState<GlobalState | null>(null);
  const [userRank, setUserRank] = useState<UserRank | null>(null);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load global state
  useEffect(() => {
    const load = async () => {
      setLoadingGlobal(true);
      try {
        const conn = new Connection(X1_RPC, 'confirmed');
        const [globalPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('global_state')], PROGRAM_ID
        );
        const info = await conn.getAccountInfo(globalPDA);
        if (info && info.data.length >= 8 + 32) {
          setGlobalState(parseGlobalState(info.data as unknown as Buffer));
        }
      } catch {
        setError('Could not load global state from chain.');
      } finally {
        setLoadingGlobal(false);
      }
    };
    load();
    // Refresh every 30s
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load user rank when wallet connects
  useEffect(() => {
    if (!publicKey) { setUserRank(null); return; }
    const load = async () => {
      setLoadingUser(true);
      try {
        const conn = new Connection(X1_RPC, 'confirmed');
        const [pda] = PublicKey.findProgramAddressSync(
          [Buffer.from('user_rank'), publicKey.toBuffer()], PROGRAM_ID
        );
        const info = await conn.getAccountInfo(pda);
        if (info && info.data.length >= 8 + 32 + 24 + 1) {
          setUserRank(parseUserRank(info.data as unknown as Buffer));
        } else {
          setUserRank(null);
        }
      } catch {
        setUserRank(null);
      } finally {
        setLoadingUser(false);
      }
    };
    load();
  }, [publicKey]);

  // Calculate live AMP from global state
  const liveAmp = globalState
    ? (() => {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const daysSinceGenesis = (now - globalState.genesisTs) / BigInt(SECONDS_PER_DAY);
        return GENESIS_BONUS > daysSinceGenesis
          ? (GENESIS_BONUS - daysSinceGenesis < MIN_AMP ? MIN_AMP : GENESIS_BONUS - daysSinceGenesis)
          : MIN_AMP;
      })()
    : null;

  const termDays = userRank ? Number(userRank.term) / SECONDS_PER_DAY : null;
  const maturityDate = userRank ? new Date(Number(userRank.maturityTs) * 1000) : null;
  const isMature = userRank ? BigInt(Math.floor(Date.now() / 1000)) >= userRank.maturityTs : false;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">DASHBOARD</h1>
        <p className="text-[#555] text-sm">Live protocol stats from X1 mainnet. Refreshes every 30s.</p>
        {error && <div className="mt-2 text-xs text-[#ff6666]">⚠ {error}</div>}
      </div>

      {/* Global Stats */}
      <section>
        <div className="text-xs font-bold tracking-widest text-[#444] uppercase mb-4">Global Protocol Stats</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Minters"
            value={globalState ? formatLargeNum(globalState.totalMinters) : '—'}
            sub="wallets that claimed rank"
            accent
            loading={loadingGlobal}
          />
          <StatCard
            label="Total Supply"
            value={globalState ? formatLargeNum(globalState.totalSupply) : '—'}
            sub="PURGE minted"
            loading={loadingGlobal}
          />
          <StatCard
            label="Current AMP"
            value={liveAmp ? liveAmp.toString() : '—'}
            sub="decreases over time"
            loading={loadingGlobal}
          />
          <StatCard
            label="Genesis"
            value={globalState
              ? new Date(Number(globalState.genesisTs) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
              : '—'}
            sub="program launch date"
            loading={loadingGlobal}
          />
        </div>
      </section>

      {/* Personal Stats */}
      <section>
        <div className="text-xs font-bold tracking-widest text-[#444] uppercase mb-4">Your Stats</div>
        {!connected ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 text-center">
            <div className="text-[#444] text-sm mb-1">Connect wallet to view personal stats</div>
            <div className="text-xs text-[#333]">Your rank, term, and claim status will appear here</div>
          </div>
        ) : loadingUser ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 text-center text-[#555] text-sm animate-pulse">
            Loading your rank...
          </div>
        ) : !userRank ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 text-center">
            <div className="text-[#444] text-sm mb-1">No active rank</div>
            <div className="text-xs text-[#333]">Go to the Mint tab to get started</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="cRank" value={`#${userRank.cRank.toString()}`} sub="your minter number" accent />
            <StatCard label="Term" value={`${termDays}d`} sub="lock duration" />
            <StatCard
              label="Maturity"
              value={maturityDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? '—'}
              sub={isMature ? '✓ Ready!' : 'not yet'}
            />
            <StatCard
              label="Status"
              value={!userRank.active ? 'Claimed' : isMature ? 'Mature' : 'Locked'}
              sub={userRank.active ? (isMature ? 'go claim rewards' : 'waiting for maturity') : 'reward collected'}
            />
          </div>
        )}
      </section>

      {/* Protocol Constants */}
      <section>
        <div className="text-xs font-bold tracking-widest text-[#444] uppercase mb-4">Protocol Constants</div>
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg divide-y divide-[#0d0d0d]">
          {[
            { label: 'Program ID', value: '8g6XCgTdm5WnQmFRZYu4DMUCJyKU1JWxKmQ16KqweP2n' },
            { label: 'Network', value: 'X1 Mainnet' },
            { label: 'Min Term', value: '1 day' },
            { label: 'Max Term', value: '500 days' },
            { label: 'Genesis AMP', value: '3,000 (decreases 1/day)' },
            { label: 'Floor AMP', value: '100' },
            { label: 'Max Amplifier (UI)', value: `${(1 + Math.log(500) * 0.5).toFixed(2)}×` },
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

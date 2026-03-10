'use client';

import { FC, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Connection } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('6K6md8GFmT8fncNbWqHSJrduYfG6HgnFCp34jdouGVSM');
const PURGE_MINT = new PublicKey('6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';
const MAX_MINT_SLOTS = 2500000;

// UserMint layout (verified against on-chain data):
// disc: [u8; 8]         offset 0
// owner: Pubkey (32)    offset 8
// slot_index: u32 (4)   offset 40
// term_days: u64 (8)    offset 44
// mature_ts: i64 (8)    offset 52
// rank: u64 (8)         offset 60
// amp: u64 (8)          offset 68  ← amp stored as actual value (e.g. 68 for AMP 68)
// reward: u64 (8)       offset 76  ← written at claim time; 0 until claimed
// claimed: bool (1)     offset 84
// bump: u8 (1)          offset 85
// total: 86 bytes
const USER_MINT_SIZE = 86;
const CLAIMED_OFFSET = 84;
const TERM_DAYS_OFFSET = 44;
const AMP_OFFSET = 68;
const INITIAL_AMP = BigInt(69); // program caps amp at this

async function fetchTotalUnclaimedPurge(conn: Connection): Promise<bigint> {
  // Fetch all 86-byte user_mint accounts where claimed == false (byte at offset 84 is 0)
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: USER_MINT_SIZE },
      { memcmp: { offset: CLAIMED_OFFSET, bytes: '1' } }, // unclaimed = 0x00, base58('1byte of 0x00') = '1'
    ],
  });

  let totalRaw = BigInt(0);
  for (const { account } of accounts) {
    const data = account.data as unknown as Buffer;
    if (data.length < USER_MINT_SIZE) continue;
    const termDays = data.readBigUInt64LE(TERM_DAYS_OFFSET);
    const ampRaw = data.readBigUInt64LE(AMP_OFFSET);
    // amp stored as amp_real << 8; on-chain formula: min(amp_real, INITIAL_AMP) × term_days
    const ampReal = ampRaw >> BigInt(8);
    const amp = ampReal > INITIAL_AMP ? INITIAL_AMP : ampReal;
    totalRaw += amp * termDays;
  }
  // totalRaw is already in whole PURGE (amp × term_days)
  return totalRaw;
}

interface GlobalState {
  totalMinters: bigint;
  activeMints: bigint;
  genesisTs: bigint;
}

interface PurgeSupply {
  uiAmount: number;
  decimals: number;
}

interface UserCounter {
  totalMinted: number;
  activeCount: number;
  nextSlot: number;
}

function parseGlobalState(data: Buffer): GlobalState {
  // 8 disc + u64 total_minters + u64 _reserved + u64 active_mints + i64 genesis_ts + u8 bump
  let offset = 8;
  const totalMinters = data.readBigUInt64LE(offset); offset += 8;
  offset += 8; // reserved field
  const activeMints = data.readBigUInt64LE(offset); offset += 8;
  const genesisTs = data.readBigInt64LE(offset);
  return { totalMinters, activeMints, genesisTs: BigInt(genesisTs) };
}

function parseUserCounter(data: Buffer): UserCounter {
  // 8 disc + 32 owner + 8 total_minted + 1 active_count + 1 next_slot + 1 bump
  let offset = 8 + 32;
  const totalMinted = Number(data.readBigUInt64LE(offset)); offset += 8;
  const activeCount = data[offset]; offset += 1;
  const nextSlot = data[offset];
  return { totalMinted, activeCount, nextSlot };
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
  const [purgeSupply, setPurgeSupply] = useState<PurgeSupply | null>(null);
  const [userCounter, setUserCounter] = useState<UserCounter | null>(null);
  const [unclaimedPurge, setUnclaimedPurge] = useState<bigint | null>(null);
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

        // Fetch PURGE token supply
        try {
          const supplyResp = await conn.getTokenSupply(PURGE_MINT);
          setPurgeSupply({
            uiAmount: supplyResp.value.uiAmount ?? 0,
            decimals: supplyResp.value.decimals,
          });
        } catch {
          // non-fatal — just leave supply as null
        }
      } catch {
        setError('Could not load global state from chain.');
      } finally {
        setLoadingGlobal(false);
      }

      // Fetch total unclaimed PURGE separately — this is slow (196k accounts)
      // so we don't block the main stats from displaying
      try {
        const conn2 = new Connection(X1_RPC, 'confirmed');
        const unclaimed = await fetchTotalUnclaimedPurge(conn2);
        setUnclaimedPurge(unclaimed);
      } catch {
        // non-fatal
      }
    };
    load();
    // Refresh every 30s
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load user_counter when wallet connects
  useEffect(() => {
    if (!publicKey) { setUserCounter(null); return; }
    const load = async () => {
      setLoadingUser(true);
      try {
        const conn = new Connection(X1_RPC, 'confirmed');
        const [pda] = PublicKey.findProgramAddressSync(
          [Buffer.from('user_counter'), publicKey.toBuffer()], PROGRAM_ID
        );
        const info = await conn.getAccountInfo(pda);
        if (info && info.data.length >= 8 + 32 + 8 + 1 + 1 + 1) {
          setUserCounter(parseUserCounter(info.data as unknown as Buffer));
        } else {
          setUserCounter(null);
        }
      } catch {
        setUserCounter(null);
      } finally {
        setLoadingUser(false);
      }
    };
    load();
  }, [publicKey]);

  const slotsUsed = userCounter ? userCounter.nextSlot : 0;
  const activeCount = userCounter ? userCounter.activeCount : 0;
  const slotsFull = activeCount >= MAX_MINT_SLOTS;

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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Minters"
            value={globalState ? formatLargeNum(globalState.totalMinters) : '—'}
            sub="wallets that claimed rank"
            accent
            loading={loadingGlobal}
          />
          <StatCard
            label="Active Mints"
            value={globalState ? formatLargeNum(globalState.activeMints) : '—'}
            sub="currently locked"
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
          <StatCard
            label="PURGE Supply"
            value={purgeSupply
              ? formatLargeNum(BigInt(Math.floor(purgeSupply.uiAmount)))
              : '—'}
            sub="circulating tokens minted"
            accent
            loading={loadingGlobal}
          />
          <StatCard
            label="Unclaimed PURGE"
            value={unclaimedPurge !== null ? formatLargeNum(unclaimedPurge) : '—'}
            sub="pending across all active mints"
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
            <div className="text-xs text-[#333]">Your mint count and claim status will appear here</div>
          </div>
        ) : loadingUser ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 text-center text-[#555] text-sm animate-pulse">
            Loading your mints...
          </div>
        ) : !userCounter ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-6 text-center">
            <div className="text-[#444] text-sm mb-1">No mints yet</div>
            <div className="text-xs text-[#333]">Go to the Mint tab to get started</div>
          </div>
        ) : (
          <>
            {slotsFull && (
              <div className="mb-4 bg-[#1a0000] border border-red-800 text-red-400 rounded px-4 py-3 text-xs font-bold tracking-widest uppercase">
                ⚠ Max Concurrent Mints Reached (2,500,000/2,500,000) — Claim rewards to free up slots
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Active Mints"
                value={`${activeCount}/${MAX_MINT_SLOTS}`}
                sub={slotsFull ? '⚠ at limit' : 'concurrent slots'}
                accent={activeCount > 0}
              />
              <StatCard
                label="Lifetime Mints"
                value={userCounter.totalMinted.toString()}
                sub="total ever minted"
              />

              <StatCard
                label="Available"
                value={`${MAX_MINT_SLOTS - activeCount}`}
                sub="slots free to mint"
              />
            </div>
          </>
        )}
      </section>

      {/* Protocol Constants */}
      <section>
        <div className="text-xs font-bold tracking-widest text-[#444] uppercase mb-4">Protocol Constants</div>
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg divide-y divide-[#0d0d0d]">
          {[
            { label: 'Program ID', value: '6K6md8GFmT8fncNbWqHSJrduYfG6HgnFCp34jdouGVSM' },
            { label: 'PURGE Mint', value: '6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP' },
            { label: 'Network', value: 'X1 Mainnet' },
            { label: 'Min Term', value: '1 day' },
            { label: 'Max Term', value: '100 days' },
            { label: 'Max Concurrent Mints', value: '2,500,000 per wallet' },
            { label: 'Genesis AMP', value: '69' },
            { label: 'AMP Decay', value: '1 per day' },
            { label: 'Min AMP', value: '0' },
            { label: 'Decimals', value: '18' },
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

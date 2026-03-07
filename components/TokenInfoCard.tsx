'use client';

import { useTokenInfo } from '@/hooks/useTokenInfo';
import { PURGE_PROGRAM_ID, PURGE_MINT_AUTHORITY } from '@/lib/constants';

function CopyButton({ text }: { text: string }) {
  const copy = () => {
    navigator.clipboard.writeText(text);
  };
  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      className="ml-2 text-slate-400 hover:text-indigo-600 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-xs w-full sm:w-32 shrink-0 uppercase font-medium">
        {label}
      </span>
      <span className="flex items-center gap-1 min-w-0">
        <span className="text-slate-700 font-mono text-xs break-all">{value}</span>
        <CopyButton text={value} />
      </span>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value: string | number; loading?: boolean }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
      <p className="text-slate-500 text-xs font-medium uppercase mb-1">
        {label}
      </p>
      {loading ? (
        <div className="h-6 bg-slate-200 rounded animate-pulse w-24" />
      ) : (
        <p className="text-slate-900 font-semibold text-lg">
          {value}
        </p>
      )}
    </div>
  );
}

export function TokenInfoCard() {
  const { tokenInfo, loading, error, refetch } = useTokenInfo();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <span className="text-indigo-600 font-bold text-sm">PRG</span>
          </div>
          <div>
            <h2 className="text-slate-900 font-bold text-lg">
              $PURGE
            </h2>
            <p className="text-slate-400 text-xs">X1 Mainnet</p>
          </div>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          title="Refresh"
          className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Supply"
          value={tokenInfo?.supply ?? '—'}
          loading={loading}
        />
        <StatCard
          label="Decimals"
          value={tokenInfo?.decimals ?? '—'}
          loading={loading}
        />
        <StatCard
          label="Standard"
          value="SPL"
          loading={false}
        />
        <StatCard
          label="Network"
          value="X1"
          loading={false}
        />
      </div>

      {/* Addresses */}
      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <AddressRow
              label="Token Mint"
              value={tokenInfo?.mintAddress ?? PURGE_MINT_AUTHORITY.toBase58()}
            />
            <AddressRow
              label="Program ID"
              value={PURGE_PROGRAM_ID.toBase58()}
            />
            <AddressRow
              label="Mint Authority"
              value={tokenInfo?.mintAuthority ?? PURGE_MINT_AUTHORITY.toBase58()}
            />
            {tokenInfo?.freezeAuthority && (
              <AddressRow
                label="Freeze Authority"
                value={tokenInfo.freezeAuthority}
              />
            )}
          </>
        )}
      </div>

      {/* Status */}
      {!loading && tokenInfo && (
        <div className="mt-4 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${tokenInfo.isInitialized ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-500">
            {tokenInfo.isInitialized ? 'Token initialized' : 'Token not initialized'}
          </span>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useClaimRank } from '@/hooks/useClaimRank';
import { MIN_TERM_DAYS, MAX_TERM_DAYS } from '@/lib/constants';
import { ClientOnly } from './ClientOnly';

function TransactionLink({ signature }: { signature: string }) {
  const explorerUrl = `https://explorer.mainnet.x1.xyz/tx/${signature}`;
  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-600 hover:text-indigo-700 text-sm font-medium inline-flex items-center gap-1"
    >
      {signature.slice(0, 12)}...{signature.slice(-8)}
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

function formatTimeRemaining(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function ClaimRankInner() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { claimRank, claiming, error, success, reset } = useClaimRank();
  const [termDays, setTermDays] = useState('100');
  const [validationError, setValidationError] = useState('');

  const validateTerm = useCallback((value: string) => {
    if (!value) {
      setValidationError('');
      return;
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setValidationError('Enter a valid number');
    } else if (num < MIN_TERM_DAYS) {
      setValidationError(`Minimum term is ${MIN_TERM_DAYS} day`);
    } else if (num > MAX_TERM_DAYS) {
      setValidationError(`Maximum term is ${MAX_TERM_DAYS} days`);
    } else {
      setValidationError('');
    }
  }, []);

  const handleTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTermDays(val);
    validateTerm(val);
    if (success || error) reset();
  };

  const handlePreset = (value: string) => {
    setTermDays(value);
    validateTerm(value);
    if (success || error) reset();
  };

  const handleClaimRank = async () => {
    if (!termDays || validationError) return;
    try {
      await claimRank(parseInt(termDays, 10));
    } catch {
      // error is already set in hook
    }
  };

  const canClaim = connected && termDays && !validationError && !claiming;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-slate-900 font-bold text-lg mb-1">
          Claim Rank
        </h2>
        <p className="text-slate-500 text-sm">
          Start a new PURGE mint with your chosen term length
        </p>
      </div>

      {/* Wallet Status */}
      {!connected ? (
        <div className="mb-6 p-6 border-2 border-dashed border-slate-200 rounded-xl text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm mb-4">
            Connect your wallet to claim rank
          </p>
          <button
            onClick={() => setVisible(true)}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all"
          >
            Connect Wallet
          </button>
        </div>
      ) : null}

      {/* Term Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-2">
            Term Length (Days)
          </label>
          <div className="relative">
            <input
              type="number"
              value={termDays}
              onChange={handleTermChange}
              placeholder="100"
              min={MIN_TERM_DAYS}
              max={MAX_TERM_DAYS}
              disabled={!connected || claiming}
              className={`w-full bg-white border rounded-lg px-4 py-3 font-mono text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-lg
                ${validationError
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                  : connected
                    ? 'border-slate-200 focus:border-indigo-500'
                    : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                }
              `}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
              days
            </span>
          </div>
          {validationError && (
            <p className="mt-1.5 text-red-600 text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {validationError}
            </p>
          )}
        </div>

        {/* Preset amounts */}
        {connected && (
          <div>
            <p className="text-slate-500 text-xs mb-2 font-medium">Quick select</p>
            <div className="flex gap-2 flex-wrap">
              {['7', '30', '100', '365', '500'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePreset(preset)}
                  disabled={claiming}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {preset}d
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-indigo-700 text-xs">
              Longer terms = higher rewards. Your rank is assigned based on global minter count.
              After maturity, return to claim your PURGE tokens.
            </p>
          </div>
        </div>

        {/* Claim Button */}
        <button
          onClick={handleClaimRank}
          disabled={!canClaim}
          className={`w-full py-3 font-semibold rounded-lg transition-all duration-200 
            ${canClaim
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {claiming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Claiming Rank...
            </span>
          ) : !connected ? (
            'Connect Wallet'
          ) : !termDays ? (
            'Enter Term Length'
          ) : validationError ? (
            'Fix Term Length'
          ) : (
            'Claim Rank'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium text-sm mb-1">
            Claim failed
          </p>
          <p className="text-red-600 text-xs break-all">
            {error}
          </p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-700 font-semibold text-sm">
              Rank claimed!
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Rank:</span>
              <span className="font-mono text-slate-900">#{success.rank}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Term:</span>
              <span className="font-mono text-slate-900">{success.termDays} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Matures:</span>
              <span className="font-mono text-slate-900">{success.maturityDate.toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-green-100">
              <span className="text-slate-500">Transaction:</span>
              <TransactionLink signature={success.signature} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Exported component with ClientOnly guard
export function ClaimRankInterface() {
  return (
    <ClientOnly
      fallback={
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-6">
            <h2 className="text-slate-900 font-bold text-lg mb-1">
              Claim Rank
            </h2>
            <p className="text-slate-400 text-sm">Loading...</p>
          </div>
          <div className="h-32 flex items-center justify-center">
            <span className="inline-block w-6 h-6 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <ClaimRankInner />
    </ClientOnly>
  );
}

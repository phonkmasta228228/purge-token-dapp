'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useClaimReward } from '@/hooks/useClaimReward';
import { useUserMint } from '@/hooks/useUserMint';
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

function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const target = targetDate.getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('Ready to claim!');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span>{timeLeft}</span>;
}

function ClaimRewardsInner() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { claimReward, claiming, error, success, reset } = useClaimReward();
  const { userMint, globalState, loading, refetch } = useUserMint();

  const handleClaimReward = async () => {
    try {
      await claimReward();
      await refetch();
    } catch {
      // error handled in hook
    }
  };

  const canClaim = connected && userMint?.isMature && !claiming;
  const hasActiveMint = connected && userMint && !userMint.claimed;
  const isMature = userMint?.isMature ?? false;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-slate-900 font-bold text-lg mb-1">
          Claim Rewards
        </h2>
        <p className="text-slate-500 text-sm">
          Claim your matured PURGE tokens
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
            Connect your wallet to view and claim rewards
          </p>
          <button
            onClick={() => setVisible(true)}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all"
          >
            Connect Wallet
          </button>
        </div>
      ) : loading ? (
        <div className="mb-6 p-6 border border-slate-200 rounded-xl text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading your mint status...</p>
        </div>
      ) : !hasActiveMint ? (
        <div className="mb-6 p-6 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-800 font-medium text-sm mb-1">No Active Mint</p>
              <p className="text-amber-700 text-xs">
                You don&apos;t have an active mint. Claim a rank first to start earning PURGE tokens.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 space-y-4">
          {/* Mint Status Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-sm">Your Rank</span>
              <span className="text-2xl font-bold text-indigo-600">#{userMint.rank}</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Term Length</span>
                <span className="font-mono text-slate-900">{userMint.termDays} days</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Maturity Date</span>
                <span className="font-mono text-slate-900">
                  {userMint.maturityDate.toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Time Remaining</span>
                <span className={`font-mono ${isMature ? 'text-green-600' : 'text-amber-600'}`}>
                  {isMature ? '✓ Matured' : <CountdownTimer targetDate={userMint.maturityDate} />}
                </span>
              </div>
              
              {userMint.claimed && (
                <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Reward Claimed</span>
                  <span className="font-mono text-slate-900">{userMint.rewardAmount} PURGE</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            isMature 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isMature ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className={isMature ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
              {isMature ? 'Ready to claim rewards!' : 'Mint still maturing'}
            </span>
          </div>
        </div>
      )}

      {/* Global Stats */}
      {globalState && connected && (
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
          <p className="text-indigo-800 font-medium text-sm mb-2">Global Stats</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-indigo-500 text-xs">Total Minters</p>
              <p className="text-indigo-900 font-mono font-medium">{globalState.totalMinters.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-indigo-500 text-xs">Active Mints</p>
              <p className="text-indigo-900 font-mono font-medium">{globalState.activeMints.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Claim Button */}
      {hasActiveMint && (
        <button
          onClick={handleClaimReward}
          disabled={!canClaim}
          className={`w-full py-3 font-semibold rounded-lg transition-all duration-200 
            ${canClaim
              ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.99] shadow-sm'
              : claiming
                ? 'bg-slate-100 text-slate-400 cursor-wait'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {claiming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Claiming...
            </span>
          ) : !isMature ? (
            'Not Mature Yet'
          ) : (
            'Claim Rewards'
          )}
        </button>
      )}

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
              Rewards claimed!
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Amount:</span>
              <span className="font-mono text-slate-900">{success.amount} PURGE</span>
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
export function ClaimRewardsInterface() {
  return (
    <ClientOnly
      fallback={
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-6">
            <h2 className="text-slate-900 font-bold text-lg mb-1">
              Claim Rewards
            </h2>
            <p className="text-slate-400 text-sm">Loading...</p>
          </div>
          <div className="h-32 flex items-center justify-center">
            <span className="inline-block w-6 h-6 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <ClaimRewardsInner />
    </ClientOnly>
  );
}

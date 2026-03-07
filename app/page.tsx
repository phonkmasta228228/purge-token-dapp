'use client';

import { TokenInfoCard } from '@/components/TokenInfoCard';
import { MintInterface } from '@/components/MintInterface';
import { ClaimRankInterface } from '@/components/ClaimRankInterface';
import { ClaimRewardsInterface } from '@/components/ClaimRewardsInterface';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-3">
            PURGE Token
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            XEN-style mining on X1 blockchain. Claim your rank, wait for maturity, and earn PURGE tokens.
          </p>
        </div>

        {/* Stats Row */}
        <div className="mb-8">
          <TokenInfoCard />
        </div>

        {/* Main Content - User Actions */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">User Actions</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClaimRankInterface />
            <ClaimRewardsInterface />
          </div>
        </div>

        {/* Admin Section */}
        <div className="mt-10 pt-10 border-t border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Admin Mint</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MintInterface />
            
            {/* Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                About PURGE
              </h2>
              <div className="space-y-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">SPL Token Standard</p>
                    <p>Built on Solana Program Library with 18 decimal precision</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Mint Authority Controlled</p>
                    <p>Tokens can only be minted by authorized wallets</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9-9a9 9 0 00-9-9m9 9H3" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">X1 Mainnet</p>
                    <p>Running on X1 blockchain with fast finality and low fees</p>
                  </div>
                </div>
              </div>

              {/* Links */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`https://explorer.mainnet.x1.xyz/address/${process.env.NEXT_PUBLIC_TOKEN_MINT || 'CYrMpw3kX92ZtGbLF9p7nQSYt7mj1J1WvDidtt5rpCyP'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Explorer
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <a
                    href="https://app.xdex.xyz/swap"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    xDEX Swap
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <a
                    href="https://chromewebstore.google.com/detail/x1-wallet/kcfmcpdmlchhbikbogddmgopmjbflnae"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    X1 Wallet
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { WalletButton } from './WalletButton';

export function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="font-bold text-white text-sm">P</span>
          </div>
          <div>
            <span className="font-bold text-slate-900 text-lg">PURGE</span>
            <span className="ml-2 text-slate-400 text-sm">/ X1</span>
          </div>
        </div>

        {/* Network badge + Wallet */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-green-700 text-xs font-medium">X1 Mainnet</span>
          </div>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

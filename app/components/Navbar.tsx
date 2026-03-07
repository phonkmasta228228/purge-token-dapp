'use client';

import { FC } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export const Navbar: FC = () => {
  return (
    <nav className="border-b border-[#1a1a1a] bg-[#0a0a0a] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#00FFAA] flex items-center justify-center">
            <span className="text-black font-black text-sm">P</span>
          </div>
          <div>
            <span className="text-[#00FFAA] font-black text-lg tracking-widest">PURGE</span>
            <span className="text-[#555] text-xs ml-2 hidden sm:inline">X1 TOKEN PROTOCOL</span>
          </div>
        </div>

        {/* Wallet Button */}
        <WalletMultiButton />
      </div>
    </nav>
  );
};

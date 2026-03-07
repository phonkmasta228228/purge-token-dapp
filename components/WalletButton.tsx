'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useState } from 'react';
import { ClientOnly } from './ClientOnly';

function WalletButtonInner() {
  const { publicKey, disconnect, connecting, connected, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [showDropdown, setShowDropdown] = useState(false);

  const truncateAddress = (address: string) =>
    `${address.slice(0, 4)}...${address.slice(-4)}`;

  if (connecting) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-medium text-sm cursor-wait flex items-center gap-2"
      >
        <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        Connecting...
      </button>
    );
  }

  if (connected && publicKey) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          {truncateAddress(publicKey.toBase58())}
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="p-3 border-b border-slate-100">
              <p className="text-slate-400 text-xs font-medium mb-1">Connected Wallet</p>
              <p className="text-slate-900 text-xs font-mono break-all">
                {publicKey.toBase58()}
              </p>
            </div>
            <button
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
              className="w-full p-3 text-left text-red-600 hover:bg-red-50 font-medium text-sm transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Disconnect
            </button>
          </div>
        )}

        {showDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all duration-200"
    >
      Connect Wallet
    </button>
  );
}

export function WalletButton() {
  return (
    <ClientOnly
      fallback={
        <button
          disabled
          className="px-4 py-2 bg-slate-100 text-slate-400 rounded-lg font-medium text-sm cursor-wait"
        >
          Connect Wallet
        </button>
      }
    >
      <WalletButtonInner />
    </ClientOnly>
  );
}

'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { X1WalletAdapter } from '@/lib/adapters/X1WalletAdapter';
import { X1_RPC_URL } from '@/lib/constants';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
  children: ReactNode;
}

/**
 * Solana Wallet Provider for X1 blockchain
 * Supports: X1 Wallet, Phantom, Solflare, Backpack
 */
export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  // Memoize wallets to prevent re-creation on renders
  const wallets = useMemo(
    () => [
      new X1WalletAdapter(),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={X1_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { X1_RPC_URL } from '@/lib/constants';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
  children: ReactNode;
}

/**
 * Solana Wallet Provider for X1 blockchain
 *
 * X1 Wallet, Phantom, Solflare, and other Wallet Standard wallets are
 * auto-detected — no explicit adapter needed for them.
 * Backpack is added explicitly as it uses a legacy adapter.
 */
export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  const wallets = useMemo(
    () => [
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

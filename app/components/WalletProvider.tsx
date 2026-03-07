'use client';

import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import '@solana/wallet-adapter-react-ui/styles.css';

const RPC_URL = process.env.NEXT_PUBLIC_X1_RPC_URL || 'https://rpc.mainnet.x1.xyz';

interface Props {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  // Wallet Standard wallets (X1, Phantom, Solflare) auto-detect
  // We only explicitly add Backpack since it doesn't support Wallet Standard
  const wallets = useMemo(() => [new BackpackWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

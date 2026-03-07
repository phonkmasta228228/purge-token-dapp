'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// Dynamically import wallet provider with SSR disabled
// This prevents the Solana Connection from being instantiated during SSR
const SolanaWalletProvider = dynamic(
  () => import('@/components/WalletProvider').then((mod) => mod.SolanaWalletProvider),
  { ssr: false }
);

interface ClientWalletProviderProps {
  children: ReactNode;
}

export function ClientWalletProvider({ children }: ClientWalletProviderProps) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}

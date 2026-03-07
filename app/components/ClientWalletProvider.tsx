'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const SolanaWalletProvider = dynamic(
  () => import('./WalletProvider').then((mod) => mod.SolanaWalletProvider),
  { ssr: false }
);

export function ClientWalletProvider({ children }: { children: ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientWalletProvider } from '@/components/ClientWalletProvider';
import { DynamicHeader } from '@/components/DynamicHeader';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PURGE | X1 Token',
  description: 'PURGE token interface on X1 blockchain. Mint and manage PURGE tokens.',
  keywords: ['PURGE', 'X1', 'token', 'mint', 'crypto', 'blockchain'],
  openGraph: {
    title: 'PURGE | X1 Token',
    description: 'PURGE token interface on X1 blockchain',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-slate-50 text-slate-900 antialiased">
        <ClientWalletProvider>
          <div className="min-h-screen flex flex-col">
            <DynamicHeader />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-slate-200 py-6 text-center">
              <p className="text-slate-400 text-sm">
                PURGE Token on X1 Mainnet
              </p>
            </footer>
          </div>
        </ClientWalletProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { ClientWalletProvider } from "./components/ClientWalletProvider";

export const metadata: Metadata = {
  title: "PURGE — X1 Token Protocol",
  description: "Claim rank, earn rewards, and build your PURGE position on X1 blockchain.",
  keywords: ["PURGE", "X1", "blockchain", "crypto", "DeFi", "Solana"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClientWalletProvider>
          {children}
        </ClientWalletProvider>
      </body>
    </html>
  );
}

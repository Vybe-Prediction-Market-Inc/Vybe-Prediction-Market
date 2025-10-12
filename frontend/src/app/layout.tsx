'use client';

import './globals.css';
import Link from 'next/link';
import { WagmiProvider } from 'wagmi';
import { getDefaultConfig, RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mainnet, base } from 'wagmi/chains';
import '@rainbow-me/rainbowkit/styles.css';

const wagmiConfig = getDefaultConfig({
  appName: 'Vybe Prediction Market',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [mainnet, base],
  ssr: true,
});

const queryClient = new QueryClient();

function NavBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[var(--bg)]/70 backdrop-blur-md border-b border-white/10">
      <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded grid place-items-center bg-[var(--brand)] text-[var(--bg)] font-extrabold">
            V
          </div>
          <Link href="/" className="font-semibold text-[var(--fg)]">
            Vybe
          </Link>
        </div>

        {/* Middle: Links */}
        <div className="hidden sm:flex items-center gap-6">
          <Link href="/" className="text-[var(--muted)] hover:text-[var(--fg)] transition">
            Home
          </Link>
          <Link href="/explore" className="text-[var(--muted)] hover:text-[var(--fg)] transition">
            Explore
          </Link>
          <Link href="/dashboard" className="text-[var(--muted)] hover:text-[var(--fg)] transition">
            Dashboard
          </Link>
          <Link href="/profile" className="text-[var(--muted)] hover:text-[var(--fg)] transition">
            Profile
          </Link>
        </div>

        {/* Right: Wallet */}
        <div className="flex items-center gap-3">
          <ConnectButton />
        </div>
      </nav>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <NavBar />
              {/* push content below fixed navbar */}
              <main className="pt-20">{children}</main>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}

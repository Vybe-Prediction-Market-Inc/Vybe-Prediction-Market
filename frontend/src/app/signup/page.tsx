'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function SignupPage() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="card w-full max-w-md">
        <div className="card-body">
          <h1 className="h2">Create account</h1>
          <p className="mt-1 muted">Connect a wallet to get started</p>

          <div className="mt-6 rounded-xl border border-white/10 p-4 bg-white/5">
            <ConnectButton />
          </div>

          <p className="mt-6 text-sm muted">
            We’ll guide you through funding and cross-chain bridging via Avail Nexus.
          </p>
        </div>
      </div>
    </div>
  );
}

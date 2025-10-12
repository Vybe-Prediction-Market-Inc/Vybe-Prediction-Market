'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function LoginPage() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="card w-full max-w-md">
        <div className="card-body">
          <h1 className="h2">Sign in</h1>
          <p className="mt-1 muted">Use your wallet to continue</p>

          <div className="mt-6 rounded-xl border border-white/10 p-4 bg-white/5">
            <ConnectButton />
          </div>

          <p className="mt-6 text-sm muted">
            Don’t have a wallet? You can create one in your browser or use a mobile wallet.
          </p>
        </div>
      </div>
    </div>
  );
}

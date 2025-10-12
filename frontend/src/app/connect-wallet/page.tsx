'use client';

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNexusOnboarding } from "@/hooks/useNexusOnboarding";

export default function ConnectWalletPage() {
  const { onboardUser, loading, isConnected } = useNexusOnboarding();

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Connect Your Wallet</h1>
      <p className="text-gray-600">
        Connect your crypto wallet to continue to Vybe.
      </p>
      <ConnectButton />
      {isConnected && (
        <button
          onClick={onboardUser}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded w-full disabled:opacity-50"
        >
          {loading ? "Onboarding..." : "Complete Onboarding"}
        </button>
      )}
    </div>
  );
}

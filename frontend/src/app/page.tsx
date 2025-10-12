"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNexusOnboarding } from "@/hooks/useNexusOnboarding";

export default function HomePage() {
  const { onboardUser, isConnected, loading } = useNexusOnboarding();

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-3xl font-bold">Vybe Prediction Market</h1>

      <ConnectButton />

      {isConnected && (
        <button
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition disabled:opacity-50"
          onClick={onboardUser}
          disabled={loading}
        >
          {loading ? "Onboarding..." : "Complete Onboarding"}
        </button>
      )}
    </div>
  );
}

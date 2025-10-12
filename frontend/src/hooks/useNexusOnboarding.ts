"use client";

import { useState } from "react";
import { useAccount, useConnectorClient } from "wagmi";
import { nexus } from "@/lib/nexus";

export function useNexusOnboarding() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useConnectorClient();
  const [loading, setLoading] = useState(false);

  const onboardUser = async () => {
    if (!address || !walletClient) return;
    setLoading(true);

    try {
      await nexus.initialize(walletClient.transport as any);

      // Example onboarding action — bridge $10 USDC to Polygon
      const result = await nexus.bridge({
        token: "USDC",
        amount: 10,
        chainId: 137, // Polygon mainnet
      });

      console.log("User onboarded via Nexus bridge:", result);
    } catch (err) {
      console.error("Onboarding error:", err);
    } finally {
      setLoading(false);
    }
  };

  return {
    onboardUser,
    loading,
    isConnected,
    address,
  };
}

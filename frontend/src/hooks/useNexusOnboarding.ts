"use client";

import { useState } from "react";
import { useAccount, useConnectorClient } from "wagmi";
import { nexus } from "@/lib/nexus";
import { EIP1193Provider, EIP1193RequestFn } from "viem";

interface NexusProvider {
  request: EIP1193RequestFn;
  on: <T extends string>(event: T, listener: (...args: any[]) => void) => NexusProvider;
  removeListener: <T extends string>(event: T, listener: (...args: any[]) => void) => NexusProvider;
}

export function useNexusOnboarding() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useConnectorClient();
  const [loading, setLoading] = useState(false);

  const onboardUser = async () => {
    if (!address || !walletClient) return;
    setLoading(true);

    try {
      const provider: NexusProvider = {
        request: walletClient.transport.request,
        on: <T extends string>(event: T, listener: (...args: any[]) => void) => {
          walletClient.transport.on?.(event, listener);
          return provider;
        },
        removeListener: <T extends string>(event: T, listener: (...args: any[]) => void) => {
          walletClient.transport.removeListener?.(event, listener);
          return provider;
        },
      };

      await nexus.initialize(provider);

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

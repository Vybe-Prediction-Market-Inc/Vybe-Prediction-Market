"use client";

import { useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function CustomWalletButton() {
  const hostRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    const realButton = hostRef.current?.querySelector("button");
    realButton?.click();
  };

  return (
    <div className="relative inline-block">
      <div
        ref={hostRef}
        className="absolute inset-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <ConnectButton />
      </div>

      <button
        onClick={handleClick}
        className="btn btn-primary"
      >
        Connect Wallet
      </button>
    </div>
  );
}

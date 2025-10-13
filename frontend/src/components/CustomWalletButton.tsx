"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function CustomWalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <button onClick={openConnectModal} className="btn btn-primary">
              Connect Wallet
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              onClick={openChainModal}
              className="flex items-center gap-1 rounded-lg bg-[var(--bg)] border px-3 py-1 hover:border-[var(--brand)] transition"
              type="button"
            >
              {chain.hasIcon && (
                <div
                  style={{
                    background: chain.iconBackground,
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  {chain.iconUrl && (
                    <img
                      alt={chain.name ?? "Chain icon"}
                      src={chain.iconUrl}
                      style={{ width: 18, height: 18 }}
                    />
                  )}
                </div>
              )}
              <span>{chain.name}</span>
            </button>

            <button
              onClick={openAccountModal}
              className="flex items-center gap-2 rounded-lg bg-[var(--bg)] border px-3 py-1 hover:border-[var(--brand)] transition"
              type="button"
            >
              {account.displayBalance ? (
                <span>{account.displayBalance}</span>
              ) : null}
              <span>{account.displayName}</span>
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

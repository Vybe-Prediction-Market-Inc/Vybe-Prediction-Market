'use client';

import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { VYBE_CONTRACT_ABI, VYBE_CONTRACT_ADDRESS } from '@/lib/contract';

interface Bet {
  marketId: number;
  betYes: boolean;
  amount: number;
  claimed: boolean;
}

export default function DashboardPage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [bets, setBets] = useState<Bet[]>([]);

  useEffect(() => {
    if (!client || !address) return;

    const loadBets = async () => {
      try {
        const result = await client.readContract({
          address: VYBE_CONTRACT_ADDRESS,
          abi: VYBE_CONTRACT_ABI,
          functionName: 'getUserBets',
          args: [address],
        });

        const parsed = (result as any[]).map((b) => ({
          marketId: Number(b.marketId),
          betYes: b.betYes,
          amount: Number(b.amount),
          claimed: b.claimed,
        }));

        setBets(parsed);
      } catch (err) {
        console.error('Error loading bets:', err);
      }
    };

    loadBets();
  }, [client, address]);

  return (
    <div className="mx-auto max-w-6xl px-4 space-y-6">
      <section className="card">
        <div className="card-body">
          <h1 className="h2">Dashboard</h1>
          <p className="mt-1 muted">
            Your active and past bets.
          </p>
        </div>
      </section>

      {bets.length === 0 ? (
        <p className="muted">No bets found.</p>
      ) : (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bets.map((bet, i) => (
            <div key={i} className="rounded-xl border border-white/10 p-4 bg-white/5">
              <div className="text-sm muted">Market #{bet.marketId}</div>
              <div className="mt-1">
                <span className={bet.betYes ? "text-green-400" : "text-red-400"}>
                  {bet.betYes ? "Yes" : "No"}
                </span>{" "}
                bet of {formatEther(BigInt(bet.amount))} ETH
              </div>
              {bet.claimed && (
                <div className="text-xs text-green-500 mt-1">✅ Claimed</div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

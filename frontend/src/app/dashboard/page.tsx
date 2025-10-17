'use client';

import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { VYBE_CONTRACT_ABI, discoverVybeContractsFromDeployers } from '@/lib/contract';

interface Bet {
  contractAddress: `0x${string}`;
  marketId: number;
  betYes: boolean;
  amount: number;
  claimed: boolean;
  question?: string;
}

export default function DashboardPage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [bets, setBets] = useState<Bet[]>([]);
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  useEffect(() => {
    if (!client || !address) return;

    const loadBets = async () => {
      try {
        const addrs = await discoverVybeContractsFromDeployers(client);
        const all: Bet[] = [];
        for (const addr of addrs) {
          const bytecode = await client.getBytecode({ address: addr });
          if (!bytecode || bytecode === '0x') continue;
          const result = await client.readContract({
            address: addr,
            abi: VYBE_CONTRACT_ABI,
            functionName: 'getUserBets',
            args: [address],
          });

          const rows = result as any[];
          if (!rows || rows.length === 0) continue;

          // Fetch market questions in parallel for this contract
          const ids = rows.map((b) => Number(b.marketId));
          const marketReads = ids.map((id) =>
            client.readContract({
              address: addr,
              abi: VYBE_CONTRACT_ABI,
              functionName: 'getMarket',
              args: [BigInt(id)],
            }) as Promise<[
              string, string, bigint, bigint, boolean, boolean, bigint, bigint
            ]>
          );
          const marketResults = await Promise.allSettled(marketReads);

          for (let i = 0; i < rows.length; i++) {
            const b = rows[i];
            const mr = marketResults[i];
            const question = mr.status === 'fulfilled' ? mr.value[0] : undefined;
            all.push({
              contractAddress: addr,
              marketId: Number(b.marketId),
              betYes: b.betYes,
              amount: Number(b.amount),
              claimed: b.claimed,
              question,
            });
          }
        }
        setBets(all);
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
          {bets.map((bet) => (
            <a key={`${bet.contractAddress}-${bet.marketId}`} href={`/event?address=${bet.contractAddress}&id=${bet.marketId}`} className="rounded-xl border border-white/10 p-4 bg-white/5 block hover:border-[var(--brand)]" title={bet.contractAddress}>
              <div className="font-medium">{bet.question || `Market #${bet.marketId}`}</div>
                <div className="text-[10px] text-white/40">Market #{bet.marketId} · {shortAddr(bet.contractAddress)}</div>
              <div className="mt-1">
                <span className={bet.betYes ? "text-green-400" : "text-red-400"}>
                  {bet.betYes ? "Yes" : "No"}
                </span>{" "}
                bet of {formatEther(BigInt(bet.amount))} ETH
              </div>
              {bet.claimed && (
                <div className="text-xs text-green-500 mt-1">✅ Claimed</div>
              )}
            </a>
          ))}
        </section>
      )}
    </div>
  );
}

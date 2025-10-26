'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { useUserBetsFromGraphQL, useMarketsFromGraphQL } from '@/hooks/useGraphQLData';

interface Bet {
  marketId: number;
  betYes: boolean;
  amount: string;
  claimed: boolean;
  question?: string;
  deadline?: number;
  resolved?: boolean;
}

export default function DashboardPage() {
  const { address } = useAccount();
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  
  // Static timestamp per mount (no live countdown)
  const nowSecRef = useRef(Math.floor(Date.now() / 1000));
  const nowSec = nowSecRef.current;

  // Use GraphQL hooks
  const { bets: userBets } = useUserBetsFromGraphQL(address);
  const { markets } = useMarketsFromGraphQL();

  const [bets, setBets] = useState<Bet[]>([]);

  // Combine bets with market info
  useEffect(() => {
    if (userBets.length > 0 && markets.length > 0) {
      const marketMap = new Map(markets.map((m) => [m.marketId, m]));
      const combined = userBets.map((bet) => {
        const market = marketMap.get(bet.marketId);
        return {
          marketId: Number(bet.marketId),
          betYes: bet.betYes,
          amount: bet.amount,
          claimed: bet.claimed,
          question: market?.question,
          deadline: market ? Number(market.deadline) : undefined,
          resolved: market?.resolved,
        };
      });
      setBets(combined);
    }
  }, [userBets, markets]);

  const formatRemaining = (seconds: number) => {
    if (seconds <= 0) return '0s';
    const d = Math.floor(seconds / 86400);
    seconds %= 86400;
    const h = Math.floor(seconds / 3600);
    seconds %= 3600;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const sortedBets = useMemo(() => {
    const arr = [...bets];
    arr.sort((a, b) => {
      const aClosed = (a.resolved === true) || (typeof a.deadline === 'number' && a.deadline <= nowSec);
      const bClosed = (b.resolved === true) || (typeof b.deadline === 'number' && b.deadline <= nowSec);
      if (aClosed !== bClosed) return aClosed ? 1 : -1; // open first
      // then sort by sooner deadline (undefined to bottom)
      const ad = typeof a.deadline === 'number' ? a.deadline : Number.MAX_SAFE_INTEGER;
      const bd = typeof b.deadline === 'number' ? b.deadline : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
    return arr;
  }, [bets, nowSec]);

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

      {sortedBets.length === 0 ? (
        <p className="muted">No bets found.</p>
      ) : (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedBets.map((bet, index) => {
            const isClosed = (bet.resolved === true) || (typeof bet.deadline === 'number' && bet.deadline <= nowSec);
            const content = (
              <>
                <div className="font-medium">{bet.question || `Market #${bet.marketId}`}</div>
                <div className="text-[10px] text-white/40 flex items-center gap-2">Market #{bet.marketId} {isClosed && <span className="inline-flex items-center rounded-full bg-white/10 text-white/70 text-[10px] px-2 py-0.5">Closed</span>}</div>
                <div className="mt-1">
                  <span className={bet.betYes ? "text-green-400" : "text-red-400"}>
                    {bet.betYes ? "Yes" : "No"}
                  </span>{" "}
                  bet of {formatEther(BigInt(bet.amount))} ETH
                </div>
                {!isClosed && typeof bet.deadline === 'number' && (
                  <div className="text-xs text-white/70 mt-1">Ends in {formatRemaining(bet.deadline - nowSec)}</div>
                )}
                {bet.claimed && (
                  <div className="text-xs text-green-500 mt-1">✅ Claimed</div>
                )}
              </>
            );

            return isClosed ? (
              <div
                key={`bet-${bet.marketId}-${index}`}
                className={`rounded-xl border border-white/10 p-4 bg-white/5 block opacity-60 cursor-not-allowed`}
                aria-disabled
                tabIndex={-1}
              >
                {content}
              </div>
            ) : (
              <a
                key={`bet-${bet.marketId}-${index}`}
                href={`/event?id=${bet.marketId}`}
                className={`rounded-xl border border-white/10 p-4 bg-white/5 block hover:border-[var(--brand)]`}
              >
                {content}
              </a>
            );
          })}
        </section>
      )}
    </div>
  );
}

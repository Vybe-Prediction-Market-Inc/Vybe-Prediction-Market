'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { GraphQLClient, gql } from 'graphql-request';

interface Bet {
  contractAddress: `0x${string}`;
  marketId: number;
  betYes: boolean;
  amount: Int;
  claimed: boolean;
  question?: string;
  deadline?: number;
  resolved?: boolean;
}

const GRAPHQL_ENDPOINT = 'https://indexer.dev.hyperindex.xyz/d2ec61d/v1/graphql';

const USER_BETS_QUERY = gql`
  query UserBets($user: String!) {
    VybePredictionMarket_BetPlaced(where: { user: $user }) {
      id
      marketId
      user
      yes
      amount
      claimed  # You may need to extend your schema as needed
    }
  }
`;

const MARKET_QUERY = gql`
  query Markets($marketIds: [Int!]) {
    VybePredictionMarket_MarketCreated(where: { marketId_in: $marketIds }) {
      marketId
      question
      trackId
      threshold
      deadline
    }
    VybePredictionMarket_Resolved(where: { marketId_in: $marketIds }) {
      marketId
      outcomeYes
      yesPool
      noPool
    }
  }
`;

export default function DashboardPage() {
  const { address } = useAccount();
  const [bets, setBets] = useState<Bet[]>([]);
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const nowSecRef = useRef(Math.floor(Date.now() / 1000));
  const nowSec = nowSecRef.current;

  useEffect(() => {
    if (!address) return;
    const client = new GraphQLClient(GRAPHQL_ENDPOINT);

    const loadBetsAndMarkets = async () => {
      try {
        const data = await client.request(USER_BETS_QUERY, { user: address.toLowerCase() });
        const userBets = data.VybePredictionMarket_BetPlaced || [];

        if (userBets.length === 0) {
          setBets([]);
          return;
        }

        const marketIds = Array.from(new Set(userBets.map((b: any) => Number(b.marketId))));
        const marketsData = await client.request(MARKET_QUERY, { marketIds });

        const markets = marketsData.VybePredictionMarket_MarketCreated || [];
        const resolutions = marketsData.VybePredictionMarket_Resolved || [];

        // Map resolutions by marketId for quick lookup
        const resolutionMap: Record<number, any> = {};
        for (const res of resolutions) {
          resolutionMap[Number(res.marketId)] = res;
        }

        // Build Bet[] with market info and resolution data
        const all: Bet[] = userBets.map((b: any) => {
          const mkt = markets.find((m: any) => Number(m.marketId) === Number(b.marketId));
          const res = resolutionMap?.[Number(b.marketId)];
          return {
            contractAddress: '0x...',  // Use a default or pass as needed
            marketId: Number(b.marketId),
            betYes: b.yes,
            amount: Number(b.amount),
            claimed: b.claimed ?? false,
            question: mkt?.question,
            deadline: mkt ? Number(mkt.deadline) : undefined,
            resolved: res ? true : false,
            yesPool: res ? Number(res.yesPool) : 0,
            noPool: res ? Number(res.noPool) : 0,
            outcomeYes: res ? res.outcomeYes : false,
          };
        });

        setBets(all);
      } catch (err) {
        console.error('Error loading bets and markets:', err);
      }
    };

    loadBetsAndMarkets();
  }, [address]);

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
      const aClosed = a.resolved || (typeof a.deadline === 'number' && a.deadline <= nowSec);
      const bClosed = b.resolved || (typeof b.deadline === 'number' && b.deadline <= nowSec);
      if (aClosed !== bClosed) return aClosed ? 1 : -1; // open first
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
          <p className="mt-1 muted">Your active and past bets.</p>
        </div>
      </section>

      {sortedBets.length === 0 ? (
        <p className="muted">No bets found.</p>
      ) : (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedBets.map((bet) => {
            const isClosed = bet.resolved || (typeof bet.deadline === 'number' && bet.deadline <= nowSec);
            const content = (
              <>
                <div className="font-medium">{bet.question || `Market #${bet.marketId}`}</div>
                <div className="text-[10px] text-white/40 flex items-center gap-2">
                  Market #{bet.marketId} · {bet.contractAddress.slice(0, 6)}…{bet.contractAddress.slice(-4)}{' '}
                  {isClosed && (
                    <span className="inline-flex items-center rounded-full bg-white/10 text-white/70 text-[10px] px-2 py-0.5">
                      Closed
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <span className={bet.betYes ? 'text-green-400' : 'text-red-400'}>
                    {bet.betYes ? 'Yes' : 'No'}
                  </span>{' '}
                  bet of {formatEther(bet.amount)} ETH
                </div>
                {!isClosed && typeof bet.deadline === 'number' && (
                  <div className="text-xs text-white/70 mt-1">Ends in {formatRemaining(bet.deadline - nowSec)}</div>
                )}
                {bet.claimed && <div className="text-xs text-green-500 mt-1">✅ Claimed</div>}
              </>
            );

            return isClosed ? (
              <div
                key={`${bet.contractAddress}-${bet.marketId}`}
                className="rounded-xl border border-white/10 p-4 bg-white/5 block opacity-60 cursor-not-allowed"
                aria-disabled
                tabIndex={-1}
                title={bet.contractAddress}
              >
                {content}
              </div>
            ) : (
              <a
                key={`${bet.contractAddress}-${bet.marketId}`}
                href={`/event?address=${bet.contractAddress}&id=${bet.marketId}`}
                className="rounded-xl border border-white/10 p-4 bg-white/5 block hover:border-[var(--brand)]"
                title={bet.contractAddress}
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

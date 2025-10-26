'use client';

import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { GraphQLClient, gql } from "graphql-request";
import { formatEther } from "viem";

interface Market {
  contractAddress: `0x${string}`;
  marketId: number;
  question: string;
  trackId: string;
  threshold: number;
  deadline: number;
  resolved: boolean;
  outcomeYes: boolean;
  yesPool: bigint;
  noPool: bigint;
}

type UserBet = {
  betYes: boolean;
  amount: bigint;
  claimed: boolean;
};

const GRAPHQL_ENDPOINT = 'https://indexer.dev.hyperindex.xyz/4cd5ec2/v1/graphql';

const MARKETS_BETS_QUERY = gql`
  query MarketsAndUserBets($user: String!) {
    VybePredictionMarket_MarketCreated {
      id
      marketId
      question
      trackId
      threshold
      deadline
      contractAddress: id
    }

    VybePredictionMarket_Resolved {
      marketId
      outcomeYes
      yesPool
      noPool
    }

    VybePredictionMarket_BetPlaced(where: { user: { _eq: $user } }) {
      marketId
      yes
      amount
    }

    VybePredictionMarket_Redeemed(where: { user: { _eq: $user } }) {
      marketId
      payout
    }
  }
`;

export default function ExplorePage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [userBets, setUserBets] = useState<Record<string, Record<number, UserBet>>>({});
  const [redeemingKeys, setRedeemingKeys] = useState<Set<string>>(new Set());
  const inFlightRedeemsRef = useRef<Set<string>>(new Set());

  const nowSecRef = useRef(Math.floor(Date.now() / 1000));
  const nowSec = nowSecRef.current;

  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  useEffect(() => {
    if (!address || !isConnected) return;
    const client = new GraphQLClient(GRAPHQL_ENDPOINT);
    const userAddress = address.toLowerCase();

    client.request(MARKETS_BETS_QUERY, { user: userAddress })
      .then(data => {
        // Map markets by marketId
        const marketsMap: Record<number, Market> = {};
        (data.VybePredictionMarket_MarketCreated || []).forEach((mkt: any) => {
          marketsMap[Number(mkt.marketId)] = {
            contractAddress: mkt.contractAddress as `0x${string}`,
            marketId: Number(mkt.marketId),
            question: mkt.question,
            trackId: mkt.trackId,
            threshold: Number(mkt.threshold),
            deadline: Number(mkt.deadline),
            resolved: false,
            outcomeYes: false,
            yesPool: 0n,
            noPool: 0n,
          };
        });

        (data.VybePredictionMarket_Resolved || []).forEach((res: any) => {
          const id = Number(res.marketId);
          if (marketsMap[id]) {
            marketsMap[id].resolved = true;
            marketsMap[id].outcomeYes = res.outcomeYes;
            marketsMap[id].yesPool = BigInt(res.yesPool);
            marketsMap[id].noPool = BigInt(res.noPool);
          }
        });

        // Process bets
        const bets = data.VybePredictionMarket_BetPlaced || [];
        // Process redeems as set of claimed marketIds
        const redeemedMarketIds = new Set(
          (data.VybePredictionMarket_Redeemed || []).map((r: any) => Number(r.marketId))
        );

        const newUserBets: Record<string, Record<number, UserBet>> = {};
        bets.forEach((bet: any) => {
          const id = Number(bet.marketId);
          const contractAddr = marketsMap[id]?.contractAddress ?? "0x0000000000000000000000000000000000000000";
          if (!newUserBets[contractAddr]) newUserBets[contractAddr] = {};
          newUserBets[contractAddr][id] = {
            betYes: bet.yes,
            amount: BigInt(bet.amount),
            claimed: redeemedMarketIds.has(id), // Mark claimed if redeemed
          };
        });

        setMarkets(Object.values(marketsMap));
        setUserBets(newUserBets);
      })
      .catch(err => {
        console.error("Failed to load markets and bets:", err);
      });
  }, [address, isConnected]);

  const formatRemaining = (seconds: number) => {
    if (seconds <= 0) return "0s";
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

  const sortedMarkets = useMemo(() => {
    const arr = [...markets];
    arr.sort((a, b) => {
      const aClosed = a.resolved || a.deadline <= nowSec;
      const bClosed = b.resolved || b.deadline <= nowSec;

      const betA = (userBets[a.contractAddress] || {})[a.marketId];
      const redeemA = Boolean(a.resolved && betA && !betA.claimed && (betA.amount > 0n) && (betA.betYes === a.outcomeYes));
      const betB = (userBets[b.contractAddress] || {})[b.marketId];
      const redeemB = Boolean(b.resolved && betB && !betB.claimed && (betB.amount > 0n) && (betB.betYes === b.outcomeYes));

      if (redeemA !== redeemB) return redeemA ? -1 : 1;
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      return a.deadline - b.deadline;
    });
    return arr;
  }, [markets, nowSec, userBets]);

  const handleRedeem = async (e: React.MouseEvent, contractAddress: `0x${string}`, marketId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isConnected || !address) return;
    const key = `${contractAddress}-${marketId}`;
    if (inFlightRedeemsRef.current.has(key)) return;
    inFlightRedeemsRef.current.add(key);
    setRedeemingKeys(prev => new Set(prev).add(key));
    try {
      // Your redeem transaction logic with writeContractAsync here
    } catch (err) {
      console.error('Redeem failed:', err);
    } finally {
      inFlightRedeemsRef.current.delete(key);
      setRedeemingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto space-y-6">
      <h1 className="h1 mb-4">Explore Events</h1>
      <SearchBar placeholder="Search for artists, tracks, or markets..." onSearch={() => {}} />

      {!sortedMarkets.length ? (
        <p className="muted mt-4">No markets found.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedMarkets.map(market => {
            const isClosed = market.resolved || market.deadline <= nowSec;
            const bet = (userBets[market.contractAddress] || {})[market.marketId];
            const eligibleToRedeem = Boolean(
              market.resolved && bet && !bet.claimed && bet.amount > 0n && bet.betYes === market.outcomeYes
            );

            const content = (
              <div className="card-body">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="h2 mb-2">{market.question}</h2>
                  {isClosed && (
                    <span className="inline-flex items-center rounded-full bg-white/10 text-white/70 text-[10px] px-2 py-0.5">
                      Closed
                    </span>
                  )}
                </div>
                <p className="muted text-xs mb-1">
                  Market #{market.marketId} · {shortAddr(market.contractAddress)}
                </p>
                <p className="muted text-sm mb-1">Track ID: {market.trackId}</p>
                {!isClosed && (
                  <p className="text-xs text-white/70 mt-1">Ends in {formatRemaining(market.deadline - nowSec)}</p>
                )}
                {eligibleToRedeem && (
                  <div className="mt-3">
                    <button
                      onClick={e => handleRedeem(e, market.contractAddress, market.marketId)}
                      className="btn btn-success rounded-full text-xs"
                      disabled={redeemingKeys.has(`${market.contractAddress}-${market.marketId}`)}
                    >
                      {redeemingKeys.has(`${market.contractAddress}-${market.marketId}`) ? 'Claiming…' : 'Redeem Winnings'}
                    </button>
                  </div>
                )}
              </div>
            );

            return isClosed ? (
              <div
                key={`${market.contractAddress}-${market.marketId}`}
                className="card transition block focus:outline-none rounded-xl opacity-60 border-white/5 cursor-not-allowed"
                aria-disabled
                tabIndex={-1}
                title={market.contractAddress}
              >
                {content}
              </div>
            ) : (
              <Link
                key={`${market.contractAddress}-${market.marketId}`}
                href={`/event?address=${market.contractAddress}&id=${market.marketId}`}
                className="card transition block focus:outline-none rounded-xl hover:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]"
                title={market.contractAddress}
              >
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

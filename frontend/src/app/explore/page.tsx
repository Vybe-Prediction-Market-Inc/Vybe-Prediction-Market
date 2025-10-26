"use client";

import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { VYBE_CONTRACT_ABI, discoverVybeContractsFromDeployers } from "@/lib/contract";
import { useMarketsFromGraphQL, useUserBetsFromGraphQL } from "@/hooks/useGraphQLData";
import { formatEther } from "viem";

interface Market {
  id: number;
  question: string;
  trackId: string;
  threshold: number;
  deadline: number;
  resolved: boolean;
  outcomeYes: boolean;
  yesPool: string;
  noPool: string;
  contractAddress: string;
}

export default function ExplorePage() {
  const client = usePublicClient();
  const { address: connectedAddress, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  
  // Static timestamp per mount (no live countdown)
  const nowSecRef = useRef(Math.floor(Date.now() / 1000));
  const nowSec = nowSecRef.current;
  const [redeemingKeys, setRedeemingKeys] = useState<Set<string>>(new Set());
  
  // Synchronous in-flight guard to prevent double-click duplicate calls
  const inFlightRedeemsRef = useRef<Set<string>>(new Set());

  // Use GraphQL hooks
  const { markets: graphqlMarkets, loading, error } = useMarketsFromGraphQL();
  const { bets: userBets } = useUserBetsFromGraphQL(connectedAddress);

  const [contractAddress, setContractAddress] = useState<`0x${string}` | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);

  // Discover contract address for write operations
  useEffect(() => {
    if (!client || contractAddress) return;
    let cancelled = false;
    const run = async () => {
      try {
        const discovered = await discoverVybeContractsFromDeployers(client);
        if (!cancelled && discovered.length > 0) {
          setContractAddress(discovered[discovered.length - 1]);
        }
      } catch {
        // ignore
      }
    };
    run();
    return () => { cancelled = true; };
  }, [client, contractAddress]);

  // Convert GraphQL markets to local format
  useEffect(() => {
    if (graphqlMarkets && contractAddress) {
      const converted = graphqlMarkets.map((m) => ({
        id: Number(m.marketId),
        question: m.question,
        trackId: m.trackId,
        threshold: Number(m.threshold),
        deadline: Number(m.deadline),
        resolved: m.resolved,
        outcomeYes: m.outcomeYes ?? false,
        yesPool: m.yesPool ?? '0',
        noPool: m.noPool ?? '0',
        contractAddress: contractAddress,
      }));
      setMarkets(converted);
    }
  }, [graphqlMarkets, contractAddress]);

  // Create a map of user bets for quick lookup
  const userBetMap = useMemo(() => {
    const map = new Map<string, { betYes: boolean; amount: string; claimed: boolean }>();
    userBets.forEach((bet) => {
      map.set(bet.marketId, {
        betYes: bet.betYes,
        amount: bet.amount,
        claimed: bet.claimed,
      });
    });
    return map;
  }, [userBets]);

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
    if (!markets) return [] as Market[];
    const arr = [...markets];
    arr.sort((a, b) => {
      const aClosed = a.resolved || a.deadline <= nowSec;
      const bClosed = b.resolved || b.deadline <= nowSec;

      const betA = userBetMap.get(a.id.toString());
      const redeemA = Boolean(a.resolved && betA && !betA.claimed && BigInt(betA.amount) > BigInt(0) && betA.betYes === a.outcomeYes);
      const betB = userBetMap.get(b.id.toString());
      const redeemB = Boolean(b.resolved && betB && !betB.claimed && BigInt(betB.amount) > BigInt(0) && betB.betYes === b.outcomeYes);

      // 1) Redeemable first
      if (redeemA !== redeemB) return redeemA ? -1 : 1;
      // 2) Open first
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      // 3) Soonest deadline
      return a.deadline - b.deadline;
    });
    return arr;
  }, [markets, nowSec, userBetMap]);

  const handleRedeem = async (e: React.MouseEvent, marketId: number) => {
    // prevent parent Link navigation when clicking inside cards
    e.preventDefault();
    e.stopPropagation();
    if (!client || !isConnected || !connectedAddress || !contractAddress) return;
    const key = `${contractAddress}-${marketId}`;
    // Synchronous guard to avoid duplicate simulate/tx from fast double-clicks
    if (inFlightRedeemsRef.current.has(key)) return;
    inFlightRedeemsRef.current.add(key);
    try {
      setRedeemingKeys(prev => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      const sim = await client.simulateContract({
        address: contractAddress,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'redeem',
        args: [BigInt(marketId)],
        account: connectedAddress,
      });
      await writeContractAsync({ ...sim.request });
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
      <SearchBar placeholder="Search for artists, tracks, or markets..." onSearch={() => { }} />

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
      {(!sortedMarkets || sortedMarkets.length === 0) && !loading ? (
        <p className="muted mt-4">No markets found.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedMarkets.map((market) => {
            const isClosed = market.resolved || market.deadline <= nowSec;
            const bet = userBetMap.get(market.id.toString());
            const eligibleToRedeem = Boolean(
              market.resolved &&
              bet &&
              !bet.claimed &&
              BigInt(bet.amount) > BigInt(0) &&
              bet.betYes === market.outcomeYes
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
                <p className="muted text-xs mb-1">Market #{market.id} · {shortAddr(market.contractAddress)}</p>
                <p className="muted text-sm mb-1">Track ID: {market.trackId}</p>
                {!isClosed && (
                  <p className="text-xs text-white/70 mt-1">Ends in {formatRemaining(market.deadline - nowSec)}</p>
                )}
                {eligibleToRedeem && contractAddress && (
                  <div className="mt-3">
                    <button
                      onClick={(e) => handleRedeem(e, market.id)}
                      className="btn btn-success rounded-full text-xs"
                      disabled={redeemingKeys.has(`${contractAddress}-${market.id}`)}
                    >
                      {redeemingKeys.has(`${contractAddress}-${market.id}`) ? 'Claiming…' : 'Redeem Winnings'}
                    </button>
                  </div>
                )}
              </div>
            );

            return isClosed ? (
              <div
                key={`${market.contractAddress}-${market.id}`}
                className={`card transition block focus:outline-none rounded-xl opacity-60 border-white/5 cursor-not-allowed`}
                aria-disabled
                tabIndex={-1}
                title={market.contractAddress}
              >
                {content}
              </div>
            ) : (
              <Link
                key={`${market.contractAddress}-${market.id}`}
                href={`/event?address=${market.contractAddress}&id=${market.id}`}
                className={`card transition block focus:outline-none rounded-xl hover:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]`}
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

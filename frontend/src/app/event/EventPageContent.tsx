
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { VYBE_CONTRACT_ABI, discoverVybeContractsFromDeployers } from '@/lib/contract';
import { useMarketByIdFromGraphQL, useUserBetForMarketFromGraphQL } from '@/hooks/useGraphQLData';

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
}

interface BetInfo {
  marketId: number;
  betYes: boolean;
  amount: string;
  claimed: boolean;
}

export default function EventPageContent() {
  const search = useSearchParams();
  const id = Number(search.get('id') ?? 1);
  const fromUrl = search.get('address') as `0x${string}` | null;
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { address: connectedAddress, isConnected } = useAccount();

  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addr, setAddr] = useState<`0x${string}` | null>(fromUrl && fromUrl.startsWith('0x') ? fromUrl : null);

  // Use GraphQL hooks for data fetching
  const { market: graphqlMarket, loading: marketLoading, error: marketError } = useMarketByIdFromGraphQL(id);
  const { bet: graphqlBet, loading: betLoading } = useUserBetForMarketFromGraphQL(connectedAddress, id);

  const [market, setMarket] = useState<Market | null>(null);
  const [userBet, setUserBet] = useState<BetInfo | null>(null);

  // Convert GraphQL market data to local format
  useEffect(() => {
    if (graphqlMarket) {
      setMarket({
        id,
        question: graphqlMarket.question,
        trackId: graphqlMarket.trackId,
        threshold: Number(graphqlMarket.threshold),
        deadline: Number(graphqlMarket.deadline),
        resolved: graphqlMarket.resolved,
        outcomeYes: graphqlMarket.outcomeYes ?? false,
        yesPool: graphqlMarket.yesPool ?? '0',
        noPool: graphqlMarket.noPool ?? '0',
      });
    }
  }, [graphqlMarket, id]);

  // Convert GraphQL bet data to local format
  useEffect(() => {
    if (graphqlBet) {
      setUserBet({
        marketId: id,
        betYes: graphqlBet.betYes,
        amount: graphqlBet.amount,
        claimed: graphqlBet.claimed,
      });
    }
  }, [graphqlBet, id]);

  // Set error from GraphQL
  useEffect(() => {
    if (marketError) {
      setError(marketError);
    }
  }, [marketError]);

  // If no address from URL or env, try to discover from configured deployers
  useEffect(() => {
    if (addr || !client) return;
    let cancelled = false;
    const run = async () => {
      try {
        const discovered = await discoverVybeContractsFromDeployers(client);
        if (!cancelled && discovered.length > 0) {
          // pick the most recent (last) discovered contract
          setAddr(discovered[discovered.length - 1]);
        }
      } catch {
        // ignore
      }
    };
    run();
    return () => { cancelled = true; };
  }, [addr, client]);

  // --- Place Bet ---
  const handleBet = async (betYes: boolean) => {
    try {
      setLoading(true);
      setError(null);
      if (!isConnected || !connectedAddress) {
        setError('Connect your wallet to place a bet.');
        return;
      }
      if (!client) {
        setError('RPC client not ready.');
        return;
      }
      if (!addr) {
        setError('Contract address unavailable.');
        return;
      }
      const functionName = betYes ? 'buyYes' : 'buyNo';
      const sim = await client.simulateContract({
        address: addr,
        abi: VYBE_CONTRACT_ABI,
        functionName,
        args: [BigInt(id)],
        account: connectedAddress,
        value: parseEther('0.1'),
      });
      const tx = await writeContractAsync({ ...sim.request });
      console.log('Bet tx:', tx);
    } catch (err) {
      console.error('Bet failed:', err);
      setError((err as Error)?.message ?? 'Bet transaction failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Redeem Winnings ---
  const handleRedeem = async () => {
    try {
      setRedeeming(true);
      setError(null);
      if (!isConnected || !connectedAddress) {
        setError('Connect your wallet to redeem.');
        return;
      }
      if (!client) {
        setError('RPC client not ready.');
        return;
      }
      if (!addr) {
        setError('Contract address unavailable.');
        return;
      }
      const sim = await client.simulateContract({
        address: addr,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'redeem',
        args: [BigInt(id)],
        account: connectedAddress,
      });
      const tx = await writeContractAsync({ ...sim.request });
      console.log('Redeem tx:', tx);
      setUserBet((prev) => (prev ? { ...prev, claimed: true } : prev));
    } catch (err) {
      console.error('Redeem failed:', err);
      setError((err as Error)?.message ?? 'Redeem failed');
    } finally {
      setRedeeming(false);
    }
  };

  // Keep closed markets accessible: no redirect; users can view details and redeem if applicable.

  if (error)
    return (
      <div className="p-6 text-center text-red-400">
        <p className="font-semibold mb-2">Error loading market</p>
        <pre className="text-sm opacity-80">{error}</pre>
      </div>
    );

  if (!market || marketLoading) return <p className="p-8 text-center">Loading market...</p>;

  const nowSec = Math.floor(Date.now() / 1000);
  const isClosed = market.resolved || market.deadline <= nowSec;
  const alreadyClaimed = userBet?.claimed ?? false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <section className="card">
        <div className="card-body">
          <div className="text-sm muted flex items-center gap-2">
            <span>Market #{id}</span>
            {isClosed && (
              <span className="inline-flex items-center rounded-full bg-white/10 text-white/70 text-[10px] px-2 py-0.5">Closed</span>
            )}
          </div>
          <h1 className="h2 mt-1">{market.question}</h1>
          <p className="mt-2 muted">Track ID: {market.trackId}</p>
          {addr && (
            <p className="mt-1 text-xs text-white/40 break-all">Contract: {addr}</p>
          )}

          <div className="mt-4 text-sm">
            <div>Yes Pool: {formatEther(BigInt(market.yesPool))} ETH</div>
            <div>No Pool: {formatEther(BigInt(market.noPool))} ETH</div>
          </div>

          {/* Bet buttons */}
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleBet(true)}
              disabled={
                loading || (!!userBet && userBet.betYes === false)
              }
              className={`btn rounded-full ${userBet?.betYes === true ? 'btn-primary' : 'btn-outline'}`}
            >
              {loading ? 'Processing...' : (isClosed ? 'Betting closed' : 'Bet Yes (0.1 ETH)')}
            </button>

            <button
              onClick={() => handleBet(false)}
              disabled={
                loading || isClosed || (!!userBet && userBet.betYes === true)
              }
              className={`btn rounded-full ${userBet?.betYes === false ? 'btn-ghost' : 'btn-outline'}`}
            >
              {loading ? 'Processing...' : (isClosed ? 'Betting closed' : 'Bet No (0.1 ETH)')}
            </button>
          </div>

          {/* Claim Winnings Button (visible only after market is resolved) */}
          {market.resolved && (
            <div className="mt-8 text-center">
              {alreadyClaimed ? (
                <div className="text-green-400 text-sm font-semibold">
                  Already Claimed
                </div>
              ) : (
                <button
                  onClick={handleRedeem}
                  disabled={!isConnected || redeeming}
                  className="btn btn-success rounded-full"
                >
                  {redeeming ? 'Claiming...' : 'Claim Winnings'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
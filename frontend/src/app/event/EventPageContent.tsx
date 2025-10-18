'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { VYBE_CONTRACT_ABI, VYBE_CONTRACT_ADDRESS } from '@/lib/contract';

interface Market {
  id: number;
  question: string;
  trackId: string;
  threshold: number;
  deadline: number;
  resolved: boolean;
  outcomeYes: boolean;
  yesPool: number;
  noPool: number;
}

interface BetInfo {
  marketId: number;
  betYes: boolean;
  amount: number;
  claimed: boolean;
}

type MarketTuple = [
  string,
  string,
  bigint,
  bigint,
  boolean,
  boolean,
  bigint,
  bigint
];

export default function EventPageContent() {
  const search = useSearchParams();
  const id = Number(search.get('id') ?? 1);
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { address: connectedAddress, isConnected } = useAccount();

  const [market, setMarket] = useState<Market | null>(null);
  const [userBet, setUserBet] = useState<BetInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch Market Data ---
  useEffect(() => {
    if (!client) return;

    const fetchMarket = async () => {
      try {
        setError(null);
        if (!VYBE_CONTRACT_ADDRESS) {
          setError('Contract address not set in env.');
          return;
        }

        const result = await client.readContract({
          address: VYBE_CONTRACT_ADDRESS,
          abi: VYBE_CONTRACT_ABI,
          functionName: 'getMarket',
          args: [BigInt(id)],
        }) as MarketTuple;

        const [
          question,
          trackId,
          threshold,
          deadline,
          resolved,
          outcomeYes,
          yesPool,
          noPool,
        ] = result;

        setMarket({
          id,
          question,
          trackId,
          threshold: Number(threshold),
          deadline: Number(deadline),
          resolved,
          outcomeYes,
          yesPool: Number(yesPool),
          noPool: Number(noPool),
        });
      } catch (err) {
        console.error('Error fetching market:', err);
        setError((err as Error)?.message ?? 'Failed to fetch market');
      }
    };

    fetchMarket();
  }, [client, id]);

  // --- Fetch user's bet info (to check if already claimed) ---
  useEffect(() => {
    if (!client || !isConnected || !connectedAddress) return;

    const loadUserBet = async () => {
      try {
        const result = await client.readContract({
          address: VYBE_CONTRACT_ADDRESS,
          abi: VYBE_CONTRACT_ABI,
          functionName: 'getUserBets',
          args: [connectedAddress],
        }) as any[];

        const parsed = result.map((b: any) => ({
          marketId: Number(b.marketId),
          betYes: b.betYes,
          amount: Number(b.amount),
          claimed: b.claimed,
        })) as BetInfo[];

        const thisMarketBet = parsed.find((b) => b.marketId === id);
        if (thisMarketBet) setUserBet(thisMarketBet);
      } catch (err) {
        console.error('Error loading user bet:', err);
      }
    };

    loadUserBet();
  }, [client, connectedAddress, id, isConnected]);

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
        setError('Client not initialized.');
        return;
      }

      const functionName = betYes ? 'buyYes' : 'buyNo';

      const sim = await client.simulateContract({
        address: VYBE_CONTRACT_ADDRESS,
        abi: VYBE_CONTRACT_ABI,
        functionName,
        args: [BigInt(id)],
        account: connectedAddress,
        value: parseEther('0.1'),
      });

      const tx = await writeContractAsync(sim.request);
      console.log('Bet placed tx hash:', tx);
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
      if (!client) {
        setError('Client not initialized.');
        return;
      }
      const sim = await client.simulateContract({
        address: VYBE_CONTRACT_ADDRESS,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'redeem',
        args: [BigInt(id)],
        account: connectedAddress,
      });

      const tx = await writeContractAsync(sim.request);
      console.log('Redeem tx hash:', tx);
      alert('Winnings claimed successfully!');
      setUserBet((prev) => (prev ? { ...prev, claimed: true } : prev));
    } catch (err) {
      console.error('Redeem failed:', err);
      setError((err as Error)?.message ?? 'Redeem transaction failed');
    } finally {
      setRedeeming(false);
    }
  };

  if (error)
    return (
      <div className="p-6 text-center text-red-400">
        <p className="font-semibold mb-2">Error loading market</p>
        <pre className="text-sm opacity-80">{error}</pre>
      </div>
    );

  if (!market) return <p className="p-8 text-center">Loading market...</p>;

  const alreadyClaimed = userBet?.claimed ?? false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <section className="card">
        <div className="card-body">
          <div className="text-sm muted">Market #{id}</div>
          <h1 className="h2 mt-1">{market.question}</h1>
          <p className="mt-2 muted">Track ID: {market.trackId}</p>

          <div className="mt-4 text-sm">
            <div>Yes Pool: {formatEther(BigInt(market.yesPool))} ETH</div>
            <div>No Pool: {formatEther(BigInt(market.noPool))} ETH</div>
          </div>

          {/* Bet buttons */}
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleBet(true)}
              disabled={
                loading ||
                market.resolved ||
                (!!userBet && userBet.betYes === false)
              }
              className={`btn rounded-full ${userBet?.betYes === true ? 'btn-primary' : 'btn-outline'
                }`}
            >
              {loading ? 'Processing...' : 'Bet Yes (0.1 ETH)'}
            </button>

            <button
              onClick={() => handleBet(false)}
              disabled={
                loading ||
                market.resolved ||
                (!!userBet && userBet.betYes === true)
              }
              className={`btn rounded-full ${userBet?.betYes === false ? 'btn-ghost' : 'btn-outline'
                }`}
            >
              {loading ? 'Processing...' : 'Bet No (0.1 ETH)'}
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

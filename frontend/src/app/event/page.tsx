'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePublicClient, useWriteContract } from 'wagmi';
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

export default function EventPage() {
  const search = useSearchParams();
  const id = Number(search.get('id') ?? 1);
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!client) return;

    const fetchMarket = async () => {
      try {
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
      }
    };

    fetchMarket();
  }, [client, id]);

  const handleBet = async (betYes: boolean) => {
  try {
    setLoading(true);
    const functionName = betYes ? 'buyYes' : 'buyNo';

    const tx = await writeContractAsync({
      address: VYBE_CONTRACT_ADDRESS,
      abi: VYBE_CONTRACT_ABI,
      functionName,
      args: [BigInt(id)],
      value: parseEther('0.1'), // e.g. 0.1 ETH bet
    });

    console.log('Bet placed tx hash:', tx);
  } catch (err) {
    console.error('Bet failed:', err);
  } finally {
    setLoading(false);
  }
  };

  if (!market) return <p className="p-8 text-center">Loading market...</p>;

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

          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleBet(true)}
              disabled={loading}
              className="btn btn-primary rounded-full"
            >
              {loading ? 'Processing...' : 'Bet Yes (100 ETH)'}
            </button>
            <button
              onClick={() => handleBet(false)}
              disabled={loading}
              className="btn btn-ghost rounded-full"
            >
              {loading ? 'Processing...' : 'Bet No (100 ETH)'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

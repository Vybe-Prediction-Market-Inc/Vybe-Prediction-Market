'use client';

import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { VYBE_CONTRACT_ABI, VYBE_CONTRACT_ADDRESS } from '@/lib/contract';
import SearchBar from '@/components/SearchBar';

type MarketTuple = [
  string,   // question
  string,   // trackId
  bigint,   // threshold
  bigint,   // deadline
  boolean,  // resolved
  boolean,  // outcomeYes
  bigint,   // yesPool
  bigint    // noPool
];

export default function ExplorePage() {
  const [markets, setMarkets] = useState<any[]>([]);
  const client = usePublicClient();

  useEffect(() => {
    if (!client) return;

    const loadMarkets = async () => {
      try {
        const count = await client.readContract({
          address: VYBE_CONTRACT_ADDRESS,
          abi: VYBE_CONTRACT_ABI,
          functionName: 'marketCount',
        });

        const total = Number(count);
        if (total === 0) {
          setMarkets([]);
          return;
        }

        // Build array of promises for all markets
        const promises = Array.from({ length: total }, (_, i) =>
          client.readContract({
            address: VYBE_CONTRACT_ADDRESS,
            abi: VYBE_CONTRACT_ABI,
            functionName: 'getMarket',
            args: [BigInt(i + 1)],
          }) as Promise<MarketTuple>
        );

        // Fetch all markets concurrently
        const results = await Promise.all(promises);

        const fetched = results.map((result, i) => {
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

          return {
            id: i + 1,
            question,
            trackId,
            threshold: Number(threshold),
            deadline: Number(deadline),
            resolved,
            outcomeYes,
            yesPool: Number(yesPool),
            noPool: Number(noPool),
          };
        });

        setMarkets(fetched);
      } catch (err) {
        console.error('Error fetching markets', err);
      }
    };

    loadMarkets();
  }, [client]);

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto space-y-6">
      <h1 className="h1 mb-4">Explore Events</h1>
      <SearchBar placeholder="Search for artists, tracks, or markets..." onSearch={() => {}} />

      {markets.length === 0 ? (
        <p className="muted mt-4">No markets found.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map((market) => (
            <div key={market.id} className="card hover:border-[var(--brand)] transition">
              <div className="card-body">
                <h2 className="h2 mb-2">{market.question}</h2>
                <p className="muted text-sm mb-4">Track ID: {market.trackId}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

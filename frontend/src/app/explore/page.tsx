"use client";

import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { useMarkets } from "@/hooks/useMarkets";

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

export default function ExplorePage() {
  const { markets, loading, error } = useMarkets();

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto space-y-6">
      <h1 className="h1 mb-4">Explore Events</h1>
      <SearchBar placeholder="Search for artists, tracks, or markets..." onSearch={() => { }} />

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
      {(!markets || markets.length === 0) && !loading ? (
        <p className="muted mt-4">No markets found.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map((market) => (
            <Link
              key={`${market.contractAddress}-${market.marketId}`}
              href={`/event?address=${market.contractAddress}&id=${market.marketId}`}
              className="card hover:border-[var(--brand)] transition block focus:outline-none focus:ring-2 focus:ring-[var(--brand)] rounded-xl"
            >
              <div className="card-body">
                <h2 className="h2 mb-2">{market.question}</h2>
                <p className="muted text-sm mb-1">Track ID: {market.trackId}</p>
              </div>
            </Link>
          ))}

        </div>
      )}
    </div>
  );
}

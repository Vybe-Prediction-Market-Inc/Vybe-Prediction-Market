'use client';

import Link from 'next/link';

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 space-y-6">
      <section className="card">
        <div className="card-body">
          <h1 className="h2">Explore Markets</h1>
          <p className="mt-1 muted">Browse trending and new markets.</p>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <Link
            key={i}
            href={`/event?slug=market-${i + 1}`}
            className="rounded-xl border border-white/10 p-5 bg-white/5 hover:border-white/20 transition"
          >
            <div className="text-sm muted">Market #{i + 1}</div>
            <div className="mt-1 font-semibold">Will ETH flip BTC by 2026?</div>
            <div className="mt-3 text-sm muted">Ends: TBA</div>
          </Link>
        ))}
      </section>
    </div>
  );
}

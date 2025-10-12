'use client';

import { useSearchParams } from 'next/navigation';
import { useNexusOnboarding } from '@/hooks/useNexusOnboarding';

export default function EventPage() {
  const search = useSearchParams();
  const slug = search.get('slug') ?? 'example-event';
  const { onboardUser, loading } = useNexusOnboarding();

  return (
    <div className="mx-auto max-w-4xl px-4">
      <section className="card">
        <div className="card-body">
          <div className="text-sm muted">Event</div>
          <h1 className="h2 mt-1 capitalize">{slug.replace('-', ' ')}</h1>
          <p className="mt-2 muted">
            Trade on the outcome. This is a placeholder event layout—hook it to your backend later.
          </p>

          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <button
              onClick={onboardUser}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Processing…' : 'Bridge $10 to Polygon (Demo)'}
            </button>
            <button className="btn btn-ghost">View Order Book</button>
          </div>
        </div>
      </section>
    </div>
  );
}

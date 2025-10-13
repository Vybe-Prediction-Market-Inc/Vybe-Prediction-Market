'use client';

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 space-y-6">
      <section className="card">
        <div className="card-body">
          <h1 className="h2">Dashboard</h1>
          <p className="mt-1 muted">
            Portfolio, positions, and balances (integrate Nexus balances here).
          </p>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-white/10 p-4 bg-white/5">
            <div className="text-sm muted">Widget #{i}</div>
            <div className="mt-1">Placeholder content</div>
          </div>
        ))}
      </section>
    </div>
  );
}

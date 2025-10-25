'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MarketSummary } from '@/lib/contract';

type ApiMarket = Omit<MarketSummary, 'yesPool' | 'noPool'> & {
  yesPool: string;
  noPool: string;
};

interface ApiResponse {
  markets?: ApiMarket[];
  error?: string;
  source?: 'envio' | 'rpc';
}

export function useMarkets(pollMs: number = 15000) {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [source, setSource] = useState<'envio' | 'rpc' | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async (force = false, showSpinner = true) => {
      if (showSpinner && !cancelled) setLoading(true);
      try {
        const qs = force ? '?force=1' : '';
        const res = await fetch(`/api/markets${qs}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data = (await res.json()) as ApiResponse;
        if (!cancelled) {
          const rows = data.markets ?? [];
          setMarkets(
            rows.map((row) => ({
              ...row,
              yesPool: BigInt(row.yesPool ?? '0'),
              noPool: BigInt(row.noPool ?? '0'),
            })),
          );
          setSource(data.source ?? null);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error)?.message ?? 'Failed to load markets');
        }
      } finally {
        if (showSpinner && !cancelled) setLoading(false);
      }
    };

    run(version > 0, true);

    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollMs > 0) {
      timer = setInterval(() => {
        run(false, false);
      }, pollMs);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [pollMs, version]);

  const refresh = () => setVersion((v) => v + 1);
  const uniqueAddresses = useMemo(() => {
    const next = new Set<`0x${string}`>();
    markets.forEach((m) => next.add(m.contractAddress));
    return Array.from(next).sort((a, b) => a.localeCompare(b));
  }, [markets]);

  return { markets, loading, error, refresh, source, contractAddresses: uniqueAddresses };
}

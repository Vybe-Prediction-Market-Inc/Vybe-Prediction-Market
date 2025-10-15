'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { fetchEnvioUser } from '@/lib/envio';
import { VYBE_CONTRACT_ABI, VYBE_CONTRACT_ADDRESS } from '@/lib/contract';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'envio' | 'onchain' | null>(null);
  const [pnlWei, setPnlWei] = useState<string | null>(null);
  const [volumeWei, setVolumeWei] = useState<string | null>(null);
  const [marketsCount, setMarketsCount] = useState<number | null>(null);
  const [activity, setActivity] = useState<Array<{ id: string; desc: string; ts: number }>>([]);

  const load = async (addr: `0x${string}`) => {
    setLoading(true);
    try {
      const envio = await fetchEnvioUser(addr);
      if (envio) {
        setSource('envio');
        setPnlWei(envio.pnl ?? null);
        setVolumeWei(envio.totalVolume ?? null);
        setMarketsCount(envio.marketsParticipated ?? null);
        const acts = (envio.bets ?? [])
          .slice(0, 8)
          .map((b) => ({ id: b.id, desc: `${b.yes ? 'Bought YES' : 'Bought NO'} • ${formatEther(BigInt(b.amount))} ETH on ${b.market.question}` , ts: b.timestamp }));
        setActivity(acts);
        return;
      }
    } catch (_) {}

    // Fallback: on-chain minimal stats (volume + markets count)
    setSource('onchain');
    if (!client) return;
    try {
      const betTuples = await client.readContract({
        address: VYBE_CONTRACT_ADDRESS,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'getUserBets',
        args: [addr],
      }) as Array<{ marketId: bigint; betYes: boolean; amount: bigint; claimed: boolean }>;
      const vol = betTuples.reduce((acc, b) => acc + b.amount, BigInt(0));
      const ids = new Set(betTuples.map((b) => Number(b.marketId)));
      setVolumeWei(vol.toString());
      setMarketsCount(ids.size);
      setPnlWei(null);
      setActivity([]);
    } catch (e) {
      console.error('profile fallback failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!address) return;
    load(address as `0x${string}`);
    const t = setInterval(() => load(address as `0x${string}`), 12000);
    return () => clearInterval(t);
  }, [address]);

  const pnl = pnlWei ? `${formatEther(BigInt(pnlWei))} ETH` : '—';
  const volume = volumeWei ? `${formatEther(BigInt(volumeWei))} ETH` : '—';
  const markets = marketsCount ?? '—';

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="card">
        <div className="card-body">
          <h1 className="h2">Your Profile</h1>
          <p className="mt-1 muted">Manage your identity and activity.</p>

          <div className="mt-6 grid sm:grid-cols-2 gap-6">
            <div className="rounded-xl border border-white/10 p-4 bg-white/5">
              <div className="text-sm muted">Wallet</div>
              <div className="mt-1 font-mono">{isConnected ? address : 'Not connected'}</div>
              {source && <div className="mt-2 text-xs muted">Source: {source === 'envio' ? 'Envio HyperSync' : 'On-chain'}</div>}
            </div>

            <div className="rounded-xl border border-white/10 p-4 bg-white/5">
              <div className="text-sm muted">Stats</div>
              <div className="mt-1">PnL: {pnl} • Markets: {markets} • Volume: {volume}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="h2">Recent Activity</h2>
        {loading && activity.length === 0 ? (
          <p className="muted">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="muted">No recent activity.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {activity.map((a) => (
              <div key={a.id} className="rounded-xl border border-white/10 p-4 bg-white/5">
                <div className="text-sm muted">{new Date((a.ts || 0) * 1000).toLocaleString()}</div>
                <div className="mt-1">{a.desc}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

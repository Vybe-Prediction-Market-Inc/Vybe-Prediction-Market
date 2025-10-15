'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther, encodeEventTopics, parseAbiItem, decodeEventLog, type Hex } from 'viem';
import { VYBE_CONTRACT_ABI, VYBE_CONTRACT_ADDRESS } from '@/lib/contract';
import { fetchEnvioUser, EnvioBet } from '@/lib/envio';

type FallbackBet = { marketId: number; betYes: boolean; amount: bigint; claimed: boolean };
type Market = [
  string, // question
  string, // trackId
  bigint, // threshold
  bigint, // deadline
  boolean, // resolved
  boolean, // outcomeYes
  bigint, // yesPool
  bigint  // noPool
];

export default function DashboardPage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [envioBets, setEnvioBets] = useState<EnvioBet[] | null>(null);
  const [fallbackBets, setFallbackBets] = useState<FallbackBet[]>([]);
  const [markets, setMarkets] = useState<Record<number, Market>>({});

  const load = async (addr: `0x${string}`) => {
    setLoading(true);
    try {
      const envio = await fetchEnvioUser(addr);
      if (envio?.bets && envio.bets.length > 0) {
        setEnvioBets(envio.bets);
        setFallbackBets([]);
        setMarkets({});
        return;
      }
    } catch (_) {}

    // Fallback: on-chain reads
    if (!client) return;
    try {
      const betTuples = await client.readContract({
        address: VYBE_CONTRACT_ADDRESS,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'getUserBets',
        args: [addr],
      }) as Array<{ marketId: bigint; betYes: boolean; amount: bigint; claimed: boolean }>;
      const parsed = betTuples.map((b) => ({ marketId: Number(b.marketId), betYes: b.betYes, amount: b.amount, claimed: b.claimed }));
      setEnvioBets(null);
      setFallbackBets(parsed);

      const ids = [...new Set(parsed.map((b) => b.marketId))];
      const results = await Promise.all(ids.map((id) => client.readContract({
        address: VYBE_CONTRACT_ADDRESS,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'getMarket',
        args: [BigInt(id)],
      })));
      const m: Record<number, Market> = {};
      ids.forEach((id, i) => { m[id] = results[i] as Market; });
      setMarkets(m);
    } catch (e) {
      console.error('load dashboard (fallback) failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!address) return;
    load(address as `0x${string}`);
    const t = setInterval(() => load(address as `0x${string}`), 8000);
    return () => clearInterval(t);
  }, [address]);

  const hasEnvio = envioBets && envioBets.length > 0;

  // Minimal inline chart data: cumulative volume over time
  const [series, setSeries] = useState<{ x: number; y: number }[]>([]);

  // Build chart data from Envio when available
  useEffect(() => {
    if (hasEnvio && envioBets) {
      const sorted = [...envioBets].sort((a, b) => a.timestamp - b.timestamp);
      let cum = 0;
      const pts: { x: number; y: number }[] = [];
      for (const b of sorted) {
        cum += Number(formatEther(BigInt(b.amount)));
        pts.push({ x: b.timestamp, y: cum });
      }
      setSeries(pts);
    }
  }, [hasEnvio, envioBets]);

  // Build chart data from on-chain events when Envio isn’t set
  useEffect(() => {
    async function loadEvents(addr: `0x${string}`) {
      if (hasEnvio || !client || !addr) return;
      try {
        const event = parseAbiItem('event BetPlaced(uint256 indexed marketId, address indexed user, bool yes, uint256 amount)');
        const topicsFilter = encodeEventTopics({ abi: [event], eventName: 'BetPlaced', args: { user: addr } });

        const logs = await client.getLogs({
          address: VYBE_CONTRACT_ADDRESS,
          topics: topicsFilter,
          fromBlock: BigInt(0),
          toBlock: 'latest',
        } as any);

        const pts: { x: number; y: number }[] = [];
        let cum = 0;
        for (const log of logs) {
          const blk = await client.getBlock({ blockHash: log.blockHash! });
          const t = [log.topics[0] as Hex, ...(log.topics.slice(1) as unknown as Hex[])] as [Hex, ...Hex[]];
          const decoded = decodeEventLog({ abi: [event], data: log.data as Hex, topics: t });
          const amount = decoded.args?.amount as bigint;
          cum += Number(formatEther(amount));
          pts.push({ x: Number((blk as any).timestamp), y: cum });
        }
        pts.sort((a, b) => a.x - b.x);
        setSeries(pts);
      } catch (e) {
        // non-fatal
        console.warn('chart load (fallback) error', e);
      }
    }
    if (address) loadEvents(address as `0x${string}`);
  }, [hasEnvio, client, address]);

  const ChartInline = ({ data }: { data: { x: number; y: number }[] }) => {
    if (!data || data.length === 0) return <div className="muted text-sm">No data</div>;
    const width = 600;
    const height = 160;
    const minX = data[0].x;
    const maxX = data[data.length - 1].x;
    const maxY = data.reduce((m, p) => (p.y > m ? p.y : m), 0);
    const dx = Math.max(1, maxX - minX);
    const dy = Math.max(1, maxY);
    const sx = (x: number) => ((x - minX) / dx) * width;
    const sy = (y: number) => height - (y / dy) * height;
    const path = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`).join(' ');
    const area = `${path} L ${sx(maxX).toFixed(2)} ${sy(0)} L ${sx(minX).toFixed(2)} ${sy(0)} Z`;
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Area chart">
        <path d={area} fill="rgba(96, 165, 250, 0.2)" />
        <path d={path} fill="none" stroke="rgb(96 165 250)" strokeWidth={2} />
      </svg>
    );
  };

  // Donut pie chart (YES vs NO totals) computed from bets shown on the page
  const yesNoTotals = useMemo(() => {
    if (hasEnvio && envioBets) {
      const yes = envioBets.filter(b => b.yes).reduce((acc, b) => acc + Number(formatEther(BigInt(b.amount))), 0);
      const no = envioBets.filter(b => !b.yes).reduce((acc, b) => acc + Number(formatEther(BigInt(b.amount))), 0);
      return { yes, no, total: yes + no };
    }
    if (!hasEnvio && fallbackBets) {
      const yes = fallbackBets.filter(b => b.betYes).reduce((acc, b) => acc + Number(formatEther(b.amount)), 0);
      const no = fallbackBets.filter(b => !b.betYes).reduce((acc, b) => acc + Number(formatEther(b.amount)), 0);
      return { yes, no, total: yes + no };
    }
    return { yes: 0, no: 0, total: 0 };
  }, [hasEnvio, envioBets, fallbackBets]);

  const Donut = ({ yes, no }: { yes: number; no: number }) => {
    const total = yes + no;
    if (total <= 0) return <div className="muted text-sm">No data</div>;
    const size = 160;
    const center = size / 2;
    const radius = 64;
    const stroke = 18;
    const C = 2 * Math.PI * radius;
    const yesRatio = Math.max(0, Math.min(1, yes / total));
    const yesLen = C * yesRatio;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${center} ${center})`}>
          {/* NO background ring */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#f87171" strokeOpacity="0.25" strokeWidth={stroke} />
          {/* YES arc on top */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#34d399"
            strokeWidth={stroke}
            strokeDasharray={`${yesLen} ${C - yesLen}`}
            strokeLinecap="butt"
          />
        </g>
        <text x={center} y={center - 6} textAnchor="middle" className="text-sm fill-white">{Math.round(yesRatio * 100)}%</text>
        <text x={center} y={center + 14} textAnchor="middle" className="text-xs fill-white">YES share</text>
      </svg>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 space-y-6">
      <section className="card">
        <div className="card-body">
          <h1 className="h2">Dashboard</h1>
          <p className="mt-1 muted">Your active and past bets.</p>
          <div className="mt-2 text-xs muted">Source: {hasEnvio ? 'Envio HyperSync' : 'On-chain'}</div>
        </div>
      </section>

      {loading && !hasEnvio && fallbackBets.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : hasEnvio ? (
        <>
          <section className="card">
            <div className="card-body grid md:grid-cols-2 gap-6 items-center">
              <div>
                <div className="text-sm muted">Your Bets Breakdown</div>
                <div className="mt-2 flex items-center gap-6">
                  <Donut yes={yesNoTotals.yes} no={yesNoTotals.no} />
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{background:'#34d399'}} /> YES: {yesNoTotals.yes.toFixed(3)} ETH</div>
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{background:'#f87171'}} /> NO: {yesNoTotals.no.toFixed(3)} ETH</div>
                    <div className="mt-2 muted">Total: {(yesNoTotals.total).toFixed(3)} ETH</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm muted">Cumulative Volume</div>
                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
                  <ChartInline data={series} />
                </div>
              </div>
            </div>
          </section>
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {envioBets!.map((b) => (
            <div key={b.id} className="rounded-xl border border-white/10 p-4 bg-white/5">
              <div className="text-sm muted">Market #{b.market.id}</div>
              <div className="mt-1 font-medium">{b.market.question}</div>
              <div className="mt-2">
                <span className={b.yes ? 'text-green-400' : 'text-red-400'}>{b.yes ? 'YES' : 'NO'}</span>{' '}
                bet of {formatEther(BigInt(b.amount))} ETH
              </div>
              <div className="mt-2 text-xs">Status: {b.market.resolved ? 'Resolved' : 'Open'}</div>
              {b.redeemed && <div className="mt-1 text-xs text-green-500">✅ Redeemed {b.payout ? `${formatEther(BigInt(b.payout))} ETH` : ''}</div>}
            </div>
          ))}
        </section>
        </>
      ) : fallbackBets.length === 0 ? (
        <p className="muted">No bets found.</p>
      ) : (
        <>
        <section className="card">
          <div className="card-body grid md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="text-sm muted">Your Bets Breakdown</div>
              <div className="mt-2 flex items-center gap-6">
                <Donut yes={yesNoTotals.yes} no={yesNoTotals.no} />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{background:'#34d399'}} /> YES: {yesNoTotals.yes.toFixed(3)} ETH</div>
                  <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{background:'#f87171'}} /> NO: {yesNoTotals.no.toFixed(3)} ETH</div>
                  <div className="mt-2 muted">Total: {(yesNoTotals.total).toFixed(3)} ETH</div>
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm muted">Cumulative Volume</div>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
                <ChartInline data={series} />
              </div>
              <div className="mt-2 text-xs muted">Using on-chain BetPlaced history. Set NEXT_PUBLIC_ENVIO_HYPERSYNC_URL for richer stats.</div>
            </div>
          </div>
        </section>
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fallbackBets.map((b, i) => {
            const m = markets[b.marketId];
            const question = m?.[0] ?? `Market #${b.marketId}`;
            const resolved = m?.[4] ?? false;
            const outcomeYes = m?.[5] ?? null;
            return (
              <div key={`${b.marketId}-${i}`} className="rounded-xl border border-white/10 p-4 bg-white/5">
                <div className="text-sm muted">Market #{b.marketId}</div>
                <div className="mt-1 font-medium">{question}</div>
                <div className="mt-2">
                  <span className={b.betYes ? 'text-green-400' : 'text-red-400'}>{b.betYes ? 'YES' : 'NO'}</span>{' '}
                  bet of {formatEther(b.amount)} ETH
                </div>
                <div className="mt-2 text-xs">Status: {resolved ? 'Resolved' : 'Open'}</div>
                {b.claimed && <div className="mt-1 text-xs text-green-500">✅ Claimed</div>}
                {resolved && outcomeYes !== null && (
                  <div className="mt-1 text-xs">Outcome: {outcomeYes ? 'YES' : 'NO'}</div>
                )}
              </div>
            );
          })}
        </section>
        </>
      )}
    </div>
  );
}

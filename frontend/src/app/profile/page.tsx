'use client';

import { useAccount } from 'wagmi';
import { useUserBetsFromGraphQL, useMarketsFromGraphQL } from '@/hooks/useGraphQLData';
import { useMemo } from 'react';
import { formatEther } from 'viem';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { bets } = useUserBetsFromGraphQL(address);
  const { markets } = useMarketsFromGraphQL();

  // Calculate user stats
  const stats = useMemo(() => {
    if (!bets || bets.length === 0) {
      return { marketCount: 0, totalVolume: '0', winCount: 0 };
    }

    const marketMap = new Map(markets.map((m) => [m.marketId, m]));
    const uniqueMarkets = new Set(bets.map((b) => b.marketId));
    const totalVolume = bets.reduce((sum, b) => sum + BigInt(b.amount), BigInt(0));
    
    // Count wins (resolved markets where user bet on winning side and hasn't claimed yet or has claimed)
    const winCount = bets.filter((bet) => {
      const market = marketMap.get(bet.marketId);
      return market?.resolved && bet.betYes === market.outcomeYes;
    }).length;

    return {
      marketCount: uniqueMarkets.size,
      totalVolume: formatEther(totalVolume),
      winCount,
    };
  }, [bets, markets]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="card">
        <div className="card-body">
          <h1 className="h2">Your Profile</h1>
          <p className="mt-1 muted">Manage your identity and activity.</p>

          <div className="mt-6 grid sm:grid-cols-2 gap-6">
            <div className="rounded-xl border border-white/10 p-4 bg-white/5">
              <div className="text-sm muted">Wallet</div>
              <div className="mt-1 font-mono text-sm break-all">
                {isConnected ? address : 'Not connected'}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 p-4 bg-white/5">
              <div className="text-sm muted">Stats</div>
              <div className="mt-1">
                Wins: {stats.winCount} • Markets: {stats.marketCount} • Volume: {stats.totalVolume} ETH
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="h2">Recent Activity</h2>
        {bets.length === 0 ? (
          <p className="muted">No recent activity.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {bets.slice(0, 4).map((bet, i) => {
              const market = markets.find((m) => m.marketId === bet.marketId);
              return (
                <div key={`${bet.marketId}-${i}`} className="rounded-xl border border-white/10 p-4 bg-white/5">
                  <div className="text-sm muted">Market #{bet.marketId}</div>
                  <div className="mt-1">
                    {market?.question || 'Unknown Market'}
                  </div>
                  <div className="mt-2 text-sm">
                    <span className={bet.betYes ? "text-green-400" : "text-red-400"}>
                      {bet.betYes ? "YES" : "NO"}
                    </span>
                    {" "}• {formatEther(BigInt(bet.amount))} ETH
                    {bet.claimed && <span className="text-green-500 ml-2">✅</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
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
  const { address: connectedAddress, isConnected } = useAccount();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;

    const fetchMarket = async () => {
      try {
        setError(null);
        // Preflight checks to avoid `returned no data (0x)`
        if (!VYBE_CONTRACT_ADDRESS) {
          setError('Contract address is not set. Define NEXT_PUBLIC_MARKET_ADDRESS in .env');
          return;
        }

        const chainId = await client.getChainId();
        console.log('[Event] chainId=', chainId, 'address=', VYBE_CONTRACT_ADDRESS, 'marketId=', id);

        const bytecode = await client.getBytecode({ address: VYBE_CONTRACT_ADDRESS });
        if (!bytecode || bytecode === '0x') {
          setError(`No contract code found at ${VYBE_CONTRACT_ADDRESS}. Is the node fresh and was the contract deployed to this chain?`);
          return;
        }

        const mc = await client.readContract({
          address: VYBE_CONTRACT_ADDRESS,
          abi: VYBE_CONTRACT_ABI,
          functionName: 'marketCount',
          args: [],
        }) as bigint;
        if (mc === BigInt(0)) {
          setError('No markets exist yet. Run the deploy script to create a demo market.');
          return;
        }
        if (BigInt(id) > mc) {
          setError(`Market ${id} does not exist (marketCount=${mc}).`);
          return;
        }

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
        setError((err as Error)?.message ?? 'Failed to fetch market');
      }
    };

    fetchMarket();
  }, [client, id]);

  const handleBet = async (betYes: boolean) => {
  try {
    setLoading(true);
    setError(null);

    if (!isConnected || !connectedAddress) {
      setError('Connect your wallet to place a bet.');
      return;
    }
    if (!client) {
      setError('RPC client not ready.');
      return;
    }

    const functionName = betYes ? 'buyYes' : 'buyNo';
    // Simulate first to surface precise revert reasons and ensure correct account/chain/value
    const sim = await client.simulateContract({
      address: VYBE_CONTRACT_ADDRESS,
      abi: VYBE_CONTRACT_ABI,
      functionName,
      args: [BigInt(id)],
      account: connectedAddress,
      value: parseEther('0.1'),
    });

    const tx = await writeContractAsync({
      ...sim.request,
    });

    console.log('Bet placed tx hash:', tx);
  } catch (err) {
    console.error('Bet failed:', err);
    setError((err as Error)?.message ?? 'Bet transaction failed');
  } finally {
    setLoading(false);
  }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold text-red-400">Unable to load market</div>
          <div className="mt-1 text-red-300 whitespace-pre-wrap">{error}</div>
          <div className="mt-2 text-red-300/80">
            Tips:
            <ul className="list-disc list-inside">
              <li>Ensure Hardhat node is running on {process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'}</li>
              <li>Redeploy and copy the address to NEXT_PUBLIC_MARKET_ADDRESS</li>
              <li>Refresh the app after redeploying the node (cache might be stale)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

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
              {loading ? 'Processing...' : 'Bet Yes (0.1 ETH)'}
            </button>
            <button
              onClick={() => handleBet(false)}
              disabled={loading}
              className="btn btn-ghost rounded-full"
            >
              {loading ? 'Processing...' : 'Bet No (0.1 ETH)'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

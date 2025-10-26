'use client';


import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { VYBE_CONTRACT_ABI } from '@/lib/contract';
import { GraphQLClient, gql } from 'graphql-request';


interface Market {
  id: number;
  question: string;
  trackId: string;
  threshold: number;
  deadline: number;
  resolved: boolean;
  outcomeYes: boolean;
  yesPool: bigint;
  noPool: bigint;
}


interface BetInfo {
  marketId: number;
  betYes: boolean;
  amount: bigint;
  claimed: boolean;
}


const GRAPHQL_ENDPOINT = 'https://indexer.dev.hyperindex.xyz/4cd5ec2/v1/graphql';


const MARKET_QUERY = gql`
  query Market($marketId: numeric!) {
    VybePredictionMarket_MarketCreated(where: { marketId: { _eq: $marketId } }) {
      id
      marketId
      question
      trackId
      threshold
      deadline
    }
    VybePredictionMarket_Resolved(where: { marketId: { _eq: $marketId } }) {
      outcomeYes
      yesPool
      noPool
    }
  }
`;


const USER_BETS_QUERY = gql`
  query UserBets($user: String!, $marketId: numeric!) {
  VybePredictionMarket_BetPlaced(
    where: {
      user: { _eq: $user },
      marketId: { _eq: $marketId }
    }
  ) {
    marketId
    yes
    amount
  }

  VybePredictionMarket_Redeemed(
    where: {
      user: { _eq: $user },
      marketId: { _eq: $marketId }
    }
  ) {
    payout
  }
}
`;


export default function EventPageContent() {
  const search = useSearchParams();
  const id = Number(search.get('id') ?? 1);
  const searchAddress = search.get('address');
  const envAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS;
  const contractId =
    (searchAddress && searchAddress.startsWith('0x') ? searchAddress : undefined) ??
    (envAddress && envAddress.startsWith('0x') ? envAddress : '');
  const { address: connectedAddress, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();


  const [market, setMarket] = useState<Market | null>(null);
  const [userBet, setUserBet] = useState<BetInfo | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Fetch market info + resolution
  useEffect(() => {
    if (!contractId || !contractId.startsWith('0x') || !id) {
      setError("Contract address not provided. Set NEXT_PUBLIC_MARKET_ADDRESS or open with ?address=0x...");
      return;
    }
    setError(null);
    const client = new GraphQLClient(GRAPHQL_ENDPOINT);


    client.request(MARKET_QUERY, { marketId: id }).then(data => {
      const mktCreated = data.VybePredictionMarket_MarketCreated?.[0];
      const resolved = data.VybePredictionMarket_Resolved?.[0];


      if (!mktCreated) {
        setError("Market not found");
        return;
      }


      setMarket({
        id,
        question: mktCreated.question,
        trackId: mktCreated.trackId,
        threshold: Number(mktCreated.threshold),
        deadline: Number(mktCreated.deadline),
        resolved: Boolean(resolved),
        outcomeYes: resolved?.outcomeYes ?? false,
        yesPool: BigInt(resolved?.yesPool ?? 0),
        noPool: BigInt(resolved?.noPool ?? 0),
      });
    }).catch(err => setError(err.message));
  }, [contractId, id]);


  // Fetch user bets and mark claimed if redeemed
  useEffect(() => {
    if (!connectedAddress || !isConnected || !id) return;


    const client = new GraphQLClient(GRAPHQL_ENDPOINT);


    client.request(USER_BETS_QUERY, {
      user: connectedAddress.toLowerCase(),
      marketId: id,
    }).then(data => {
      const bets = data.VybePredictionMarket_BetPlaced || [];
      const redeems = data.VybePredictionMarket_Redeemed || [];


      if (bets.length === 0) {
        setUserBet(null);
        setAlreadyClaimed(false);
        return;
      }


      const redeemedMarketIds = new Set(redeems.map((r: any) => r.marketId));
      const bet = bets[0];
      setUserBet({
        marketId: Number(bet.marketId),
        betYes: bet.yes,
        amount: BigInt(bet.amount),
        claimed: redeemedMarketIds.has(bet.marketId),
      });
      setAlreadyClaimed(redeemedMarketIds.has(bet.marketId));
    }).catch(console.error);
  }, [connectedAddress, isConnected, id]);


  // Place Bet transaction
  const handleBet = async (betYes: boolean) => {
    if (!isConnected || !connectedAddress || !contractId) {
      setError('Connect your wallet with a contract address.');
      return;
    }
    setLoading(true);
    setError(null);


    try {
      const tx = await writeContractAsync({
        address: contractId as `0x${string}`,
        abi: VYBE_CONTRACT_ABI,
        functionName: betYes ? 'buyYes' : 'buyNo',
        args: [BigInt(id)],
        value: parseEther('0.1'),
      });
      console.log('Bet tx:', tx);
    } catch (err) {
      console.error('Bet failed:', err);
      setError((err as Error).message ?? 'Bet failed');
    } finally {
      setLoading(false);
    }
  };


  // Redeem transaction
  const handleRedeem = async () => {
    if (!isConnected || !connectedAddress || !contractId) {
      setError('Connect your wallet with a contract address.');
      return;
    }
    setRedeeming(true);
    setError(null);


    try {
      const tx = await writeContractAsync({
        address: contractId as `0x${string}`,
        abi: VYBE_CONTRACT_ABI,
        functionName: 'redeem',
        args: [BigInt(id)],
      });
      console.log('Redeem tx:', tx);
      setAlreadyClaimed(true);
    } catch (err) {
      console.error('Redeem failed:', err);
      setError((err as Error).message ?? 'Redeem failed');
    } finally {
      setRedeeming(false);
    }
  };


  if (error) return (
    <div className="p-6 text-center text-red-400">
      <p className="font-semibold mb-2">Error loading market</p>
      <pre className="text-sm opacity-80">{error}</pre>
    </div>
  );


  if (!market) return <p className="p-8 text-center">Loading market...</p>;


  const nowSec = Math.floor(Date.now() / 1000);
  const isClosed = market.resolved || market.deadline <= nowSec;


  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <section className="card">
        <div className="card-body">
          <div className="text-sm muted flex items-center gap-2">
            <span>Market #{id}</span>
            {isClosed && (
              <span className="inline-flex items-center rounded-full bg-white/10 text-white/70 text-[10px] px-2 py-0.5">Closed</span>
            )}
          </div>
          <h1 className="h2 mt-1">{market.question}</h1>
          <p className="mt-2 muted">Track ID: {market.trackId}</p>
          {contractId && (
            <p className="mt-1 text-xs text-white/40 break-all">Contract: {contractId}</p>
          )}


          <div className="mt-4 text-sm">
            <div>Yes Pool: {formatEther(market.yesPool)} ETH</div>
            <div>No Pool: {formatEther(market.noPool)} ETH</div>
          </div>


          {/* Bet buttons */}
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleBet(true)}
              disabled={loading || (!!userBet && userBet.betYes === false) || isClosed}
              className={`btn rounded-full ${userBet?.betYes === true ? 'btn-primary' : 'btn-outline'}`}
            >
              {loading ? 'Processing...' : (isClosed ? 'Betting closed' : 'Bet Yes (0.1 ETH)')}
            </button>


            <button
              onClick={() => handleBet(false)}
              disabled={loading || isClosed || (!!userBet && userBet.betYes === true)}
              className={`btn rounded-full ${userBet?.betYes === false ? 'btn-ghost' : 'btn-outline'}`}
            >
              {loading ? 'Processing...' : (isClosed ? 'Betting closed' : 'Bet No (0.1 ETH)')}
            </button>
          </div>


          {/* Claim Winnings Button (visible only after market is resolved) */}
          {market.resolved && (
            <div className="mt-8 text-center">
              {alreadyClaimed ? (
                <div className="text-green-400 text-sm font-semibold">Already Claimed</div>
              ) : (
                <button
                  onClick={handleRedeem}
                  disabled={!isConnected || redeeming}
                  className="btn btn-success rounded-full"
                >
                  {redeeming ? 'Claiming...' : 'Claim Winnings'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

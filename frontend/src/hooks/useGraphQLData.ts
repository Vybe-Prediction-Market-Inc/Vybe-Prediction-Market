/**
 * GraphQL hooks for querying Envio/Hasura backend
 * Uses Hasura-compatible filter syntax with comparison operators (_eq, _gte, _lte, etc.)
 */

import { useEffect, useState } from 'react';
import { graphqlQuery } from '@/lib/graphql-client';

// Type definitions matching Envio schema with numeric types
export interface BetPlacedEvent {
  id: string;
  marketId: string; // numeric from Hasura
  user: string;
  yes: boolean;
  amount: string; // numeric from Hasura
}

export interface MarketCreatedEvent {
  id: string;
  marketId: string; // numeric from Hasura
  question: string;
  trackId: string;
  threshold: string; // numeric from Hasura
  deadline: string; // numeric from Hasura
}

export interface RedeemedEvent {
  id: string;
  marketId: string; // numeric from Hasura
  user: string;
  payout: string; // numeric from Hasura
}

export interface ResolvedEvent {
  id: string;
  marketId: string; // numeric from Hasura
  outcomeYes: boolean;
  yesPool: string; // numeric from Hasura
  noPool: string; // numeric from Hasura
}

// Composite type for market with all info
export interface MarketWithEvents {
  marketId: string;
  question: string;
  trackId: string;
  threshold: string;
  deadline: string;
  resolved: boolean;
  outcomeYes?: boolean;
  yesPool?: string;
  noPool?: string;
}

// User bet with claimed status reconstructed
export interface UserBetWithClaimed {
  marketId: string;
  user: string;
  betYes: boolean;
  amount: string;
  claimed: boolean;
}

/**
 * Hook to fetch all markets with their creation and resolution data
 */
export function useMarketsFromGraphQL() {
  const [markets, setMarkets] = useState<MarketWithEvents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);

        // Query for all market created events
        const query = `
          query GetMarkets {
            VybePredictionMarket_MarketCreated {
              id
              marketId
              question
              trackId
              threshold
              deadline
            }
            VybePredictionMarket_Resolved {
              id
              marketId
              outcomeYes
              yesPool
              noPool
            }
          }
        `;

        const data = await graphqlQuery<{
          VybePredictionMarket_MarketCreated: MarketCreatedEvent[];
          VybePredictionMarket_Resolved: ResolvedEvent[];
        }>(query);

        // Build a map of resolved markets
        const resolvedMap = new Map<string, ResolvedEvent>();
        data.VybePredictionMarket_Resolved.forEach((r) => {
          resolvedMap.set(r.marketId, r);
        });

        // Combine market created with resolved data
        const marketsWithEvents = data.VybePredictionMarket_MarketCreated.map((m) => {
          const resolved = resolvedMap.get(m.marketId);
          return {
            marketId: m.marketId,
            question: m.question,
            trackId: m.trackId,
            threshold: m.threshold,
            deadline: m.deadline,
            resolved: !!resolved,
            outcomeYes: resolved?.outcomeYes,
            yesPool: resolved?.yesPool,
            noPool: resolved?.noPool,
          };
        });

        setMarkets(marketsWithEvents);
      } catch (err) {
        console.error('Error fetching markets from GraphQL:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  return { markets, loading, error };
}

/**
 * Hook to fetch a specific market by ID
 */
export function useMarketByIdFromGraphQL(marketId: number) {
  const [market, setMarket] = useState<MarketWithEvents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        setLoading(true);
        setError(null);

        // Query for specific market using Hasura comparison operator
        const query = `
          query GetMarket($marketId: numeric!) {
            VybePredictionMarket_MarketCreated(where: { marketId: { _eq: $marketId } }) {
              id
              marketId
              question
              trackId
              threshold
              deadline
            }
            VybePredictionMarket_Resolved(where: { marketId: { _eq: $marketId } }) {
              id
              marketId
              outcomeYes
              yesPool
              noPool
            }
          }
        `;

        const data = await graphqlQuery<{
          VybePredictionMarket_MarketCreated: MarketCreatedEvent[];
          VybePredictionMarket_Resolved: ResolvedEvent[];
        }>(query, { marketId: marketId.toString() });

        if (data.VybePredictionMarket_MarketCreated.length === 0) {
          setError('Market not found');
          setMarket(null);
          return;
        }

        const m = data.VybePredictionMarket_MarketCreated[0];
        const resolved = data.VybePredictionMarket_Resolved[0];

        setMarket({
          marketId: m.marketId,
          question: m.question,
          trackId: m.trackId,
          threshold: m.threshold,
          deadline: m.deadline,
          resolved: !!resolved,
          outcomeYes: resolved?.outcomeYes,
          yesPool: resolved?.yesPool,
          noPool: resolved?.noPool,
        });
      } catch (err) {
        console.error('Error fetching market from GraphQL:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchMarket();
  }, [marketId]);

  return { market, loading, error };
}

/**
 * Hook to fetch user bets with claimed status reconstructed
 * Queries both BetPlaced and Redeemed events and combines them
 */
export function useUserBetsFromGraphQL(userAddress: string | undefined) {
  const [bets, setBets] = useState<UserBetWithClaimed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setBets([]);
      setLoading(false);
      return;
    }

    const fetchUserBets = async () => {
      try {
        setLoading(true);
        setError(null);

        // Query for user's bets and redemptions using Hasura comparison operator
        const query = `
          query GetUserBets($user: String!) {
            VybePredictionMarket_BetPlaced(where: { user: { _eq: $user } }) {
              id
              marketId
              user
              yes
              amount
            }
            VybePredictionMarket_Redeemed(where: { user: { _eq: $user } }) {
              id
              marketId
              user
              payout
            }
          }
        `;

        const data = await graphqlQuery<{
          VybePredictionMarket_BetPlaced: BetPlacedEvent[];
          VybePredictionMarket_Redeemed: RedeemedEvent[];
        }>(query, { user: userAddress.toLowerCase() });

        // Create a set of redeemed market IDs for this user
        const redeemedMarkets = new Set<string>();
        data.VybePredictionMarket_Redeemed.forEach((r) => {
          redeemedMarkets.add(r.marketId);
        });

        // Aggregate bets by market (sum amounts if multiple bets)
        const betsByMarket = new Map<string, { betYes: boolean; amount: bigint }>();
        data.VybePredictionMarket_BetPlaced.forEach((bet) => {
          const existing = betsByMarket.get(bet.marketId);
          if (existing) {
            // Sum amounts if multiple bets on same side
            if (existing.betYes === bet.yes) {
              existing.amount += BigInt(bet.amount);
            }
          } else {
            betsByMarket.set(bet.marketId, {
              betYes: bet.yes,
              amount: BigInt(bet.amount),
            });
          }
        });

        // Reconstruct bets with claimed status
        const betsWithClaimed: UserBetWithClaimed[] = Array.from(betsByMarket.entries()).map(
          ([marketId, { betYes, amount }]) => ({
            marketId,
            user: userAddress,
            betYes,
            amount: amount.toString(),
            claimed: redeemedMarkets.has(marketId),
          })
        );

        setBets(betsWithClaimed);
      } catch (err) {
        console.error('Error fetching user bets from GraphQL:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserBets();
  }, [userAddress]);

  return { bets, loading, error };
}

/**
 * Hook to fetch a specific user's bet for a specific market
 */
export function useUserBetForMarketFromGraphQL(userAddress: string | undefined, marketId: number) {
  const [bet, setBet] = useState<UserBetWithClaimed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setBet(null);
      setLoading(false);
      return;
    }

    const fetchUserBet = async () => {
      try {
        setLoading(true);
        setError(null);

        // Query for user's bet and redemption for specific market
        const query = `
          query GetUserBetForMarket($user: String!, $marketId: numeric!) {
            VybePredictionMarket_BetPlaced(where: { 
              user: { _eq: $user }, 
              marketId: { _eq: $marketId } 
            }) {
              id
              marketId
              user
              yes
              amount
            }
            VybePredictionMarket_Redeemed(where: { 
              user: { _eq: $user }, 
              marketId: { _eq: $marketId } 
            }) {
              id
              marketId
              user
              payout
            }
          }
        `;

        const data = await graphqlQuery<{
          VybePredictionMarket_BetPlaced: BetPlacedEvent[];
          VybePredictionMarket_Redeemed: RedeemedEvent[];
        }>(query, { 
          user: userAddress.toLowerCase(), 
          marketId: marketId.toString() 
        });

        if (data.VybePredictionMarket_BetPlaced.length === 0) {
          setBet(null);
          return;
        }

        // Aggregate multiple bets on same market
        const betYes = data.VybePredictionMarket_BetPlaced[0].yes;
        const totalAmount = data.VybePredictionMarket_BetPlaced.reduce(
          (sum, b) => sum + BigInt(b.amount),
          BigInt(0)
        );

        const claimed = data.VybePredictionMarket_Redeemed.length > 0;

        setBet({
          marketId: marketId.toString(),
          user: userAddress,
          betYes,
          amount: totalAmount.toString(),
          claimed,
        });
      } catch (err) {
        console.error('Error fetching user bet from GraphQL:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserBet();
  }, [userAddress, marketId]);

  return { bet, loading, error };
}

# GraphQL Migration Guide

This document describes the migration to Envio's GraphQL backend with Hasura schema compliance.

## Configuration

### Environment Variables

Add the following environment variable to your `.env.local` file:

```env
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:8080/v1/graphql
```

Replace the URL with your actual Envio/Hasura GraphQL endpoint.

## Changes Made

### 1. Schema Updates

The Envio schema (located at `envio/schema.graphql` from the project root) has been updated to use `numeric` types instead of `BigInt` for Hasura compatibility:

- `marketId: numeric!`
- `amount: numeric!`
- `threshold: numeric!`
- `deadline: numeric!`
- `yesPool: numeric!`
- `noPool: numeric!`
- `payout: numeric!`

### 2. TypeScript Configuration

Updated `tsconfig.json` to target ES2020 for BigInt literal support.

### 3. GraphQL Infrastructure

#### `src/lib/graphql-client.ts`
Basic GraphQL client for making queries to the Envio/Hasura backend.

#### `src/hooks/useGraphQLData.ts`
Comprehensive hooks for querying data:

- `useMarketsFromGraphQL()` - Fetch all markets with creation and resolution data
- `useMarketByIdFromGraphQL(marketId)` - Fetch a specific market
- `useUserBetsFromGraphQL(userAddress)` - Fetch user bets with claimed status reconstruction
- `useUserBetForMarketFromGraphQL(userAddress, marketId)` - Fetch specific bet for a market

### 4. Claimed Status Reconstruction

The claimed status is reconstructed client-side by:
1. Querying `VybePredictionMarket_BetPlaced` events for user bets
2. Querying `VybePredictionMarket_Redeemed` events for redemptions
3. Combining the data: a bet is marked as claimed if a corresponding redeem event exists

### 5. Hasura Filter Syntax

All GraphQL queries use Hasura-compatible comparison operators:

```graphql
query GetMarket($marketId: numeric!) {
  VybePredictionMarket_MarketCreated(where: { marketId: { _eq: $marketId } }) {
    # fields...
  }
}
```

### 6. Frontend Pages

All pages have been updated to use GraphQL for data fetching:

- **EventPageContent**: Uses GraphQL for market and user bet data
- **ExplorePage**: Uses GraphQL for markets list and user bets
- **Dashboard**: Uses GraphQL for user bets with market information
- **Profile**: Shows real stats calculated from GraphQL data

Contract write operations (placing bets, redeeming) still use wagmi/viem for blockchain interactions.

## Data Flow

```
Blockchain Events → Envio Indexer → Hasura/PostgreSQL → GraphQL API → Frontend
                                                             ↓
                                          (wagmi/viem for writes)
```

## Testing

1. Ensure your Envio indexer is running and has indexed some events
2. Configure the `NEXT_PUBLIC_GRAPHQL_ENDPOINT` environment variable
3. Run the frontend: `npm run dev`
4. Navigate to different pages to verify data is loading from GraphQL

## Troubleshooting

### "No data returned from GraphQL query"
- Verify the GraphQL endpoint is accessible
- Check that the Envio indexer has processed events
- Ensure the schema matches the queries

### TypeScript errors with BigInt
- Ensure `frontend/tsconfig.json` has `"target": "ES2020"` or higher

### Claimed status not showing correctly
- Verify both BetPlaced and Redeemed events are being indexed
- Check that user addresses match (case-sensitive)

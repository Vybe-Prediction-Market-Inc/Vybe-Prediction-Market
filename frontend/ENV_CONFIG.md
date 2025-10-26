# Environment Configuration

## Frontend Environment Variables

Create a `.env.local` file in the `frontend` directory with the following variables:

### Required

```env
# GraphQL Endpoint for Envio/Hasura backend
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:8080/v1/graphql
```

Replace `http://localhost:8080/v1/graphql` with your actual Envio/Hasura GraphQL endpoint URL.

### Optional

```env
# Contract deployer addresses for contract discovery
# Single deployer address:
NEXT_PUBLIC_DEPLOYER_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEa1

# Or multiple deployer addresses (JSON array):
NEXT_PUBLIC_DEPLOYER_ADDRESSES=["0x742d35...", "0x5678..."]

# Block scanning configuration for contract discovery
NEXT_PUBLIC_SCAN_START_BLOCK=0
NEXT_PUBLIC_SCAN_BLOCKS=2000
```

## How It Works

### GraphQL Endpoint
The frontend uses this endpoint to query indexed blockchain events from Envio/Hasura. All market data, user bets, and redemption information is fetched through GraphQL queries.

### Deployer Addresses
When opening the event page without an explicit contract address, the frontend will scan recent blocks for contract deployments from the configured deployer addresses. This allows the UI to automatically discover and interact with deployed contracts.

### Block Scanning
- `NEXT_PUBLIC_SCAN_START_BLOCK`: Starting block number for contract discovery (default: latest block - 2000)
- `NEXT_PUBLIC_SCAN_BLOCKS`: Maximum number of blocks to scan (default: 2000)

## Example Configuration

For local development with Envio running on localhost:

```env
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:8080/v1/graphql
NEXT_PUBLIC_DEPLOYER_ADDRESS=0xYourDeployerAddress
```

For production with hosted Envio/Hasura:

```env
NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://your-app.hasura.app/v1/graphql
NEXT_PUBLIC_DEPLOYER_ADDRESSES=["0xDeployer1", "0xDeployer2"]
NEXT_PUBLIC_SCAN_START_BLOCK=1000000
```

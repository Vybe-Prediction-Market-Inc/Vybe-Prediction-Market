# Vybe — Music Prediction Markets on Base

Hackathon project for ETHGlobal Online

## Structure
- `contracts/` → Solidity smart contracts (Hardhat)
- `frontend/` → Next.js 15 + Wagmi + Tailwind frontend
- `oracle/` → Spotify data fetcher + oracle poster

## Quick Start
```bash
# Contracts
cd contracts
npx hardhat compile
npx hardhat test

# Frontend
cd frontend
npm run dev

# Oracle
cd oracle
node index.js
```

## Envio Market Cache Prototype

The frontend now loads markets from `/api/markets`, a Next.js route that caches data on the server.

- Configure an Envio GraphQL endpoint with `VYBE_ENVIO_URL` (server) or `NEXT_PUBLIC_ENVIO_URL` (browser-safe). The API tries Envio first and falls back to on-chain reads.
- Limit how many markets the prototype fetches with `VYBE_ENVIO_MARKET_LIMIT` / `NEXT_PUBLIC_ENVIO_MARKET_LIMIT` (defaults to `200`).
- Control the cache duration by setting `VYBE_MARKET_CACHE_MS` / `NEXT_PUBLIC_VYBE_MARKET_CACHE_MS` (defaults to `15000` milliseconds).
- Without Envio data the route discovers contracts as before, but now batches `getMarket` calls with Viem `multicall` so a single RPC snapshot populates the entire frontend.
- Provide explicit Vybe contract addresses using `VYBE_CONTRACT_ADDRESSES` or `NEXT_PUBLIC_VYBE_CONTRACT_ADDRESSES` (JSON array or comma-separated). When set, the cache skips chain scans and only queries those contracts.
- User-specific bet data is fetched through `/api/user?address=0x...`, which caches each wallet’s snapshot. Adjust the TTL with `VYBE_USER_CACHE_MS` / `NEXT_PUBLIC_VYBE_USER_CACHE_MS` (default `10000` ms).

The `useMarkets` hook polls this API, so the Explore view, dashboard, and any other consumer share the same cached snapshot. Call `refresh()` from the hook (or visit `/api/markets?force=1`) after creating or resolving markets to bust the cache immediately.

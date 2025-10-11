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

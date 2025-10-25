import type { EnvioConfig } from "@envio-dev/cli";

const CONTRACT_ADDRESSES = (
  process.env.VYBE_CONTRACT_ADDRESSES ||
  process.env.NEXT_PUBLIC_VYBE_CONTRACT_ADDRESSES ||
  ""
)
  .split(",")
  .map((addr) => addr.trim())
  .filter((addr) => addr.startsWith("0x"));

const START_BLOCK =
  Number(process.env.VYBE_START_BLOCK ?? process.env.NEXT_PUBLIC_SCAN_START_BLOCK) ||
  0;

const config: EnvioConfig = {
  project: {
    name: "vybe",
    schema: "./schema.graphql",
  },
  datasource: {
    kind: "ethereum",
    chain: process.env.VYBE_ENVIO_CHAIN ?? "base-sepolia",
    rpcUrl: process.env.VYBE_ENVIO_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545",
  },
  contracts: [
    {
      name: "VybePredictionMarket",
      abi: "../contracts/artifacts/contracts/VybePredictionMarket.sol/VybePredictionMarket.json",
      address: CONTRACT_ADDRESSES,
      startBlock: START_BLOCK,
      events: [
        "MarketCreated(uint256,string,string,uint256,uint256)",
        "BetPlaced(uint256,address,bool,uint256)",
        "Resolved(uint256,bool,uint256,uint256)",
        "Redeemed(uint256,address,uint256)",
      ],
    },
  ],
};

export default config;

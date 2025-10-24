import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthers],
  solidity: "0.8.28",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      type: "http",
    },
    hardhat: {
        url: "http://127.0.0.1:8545",
        type: "http",
    },
    sepolia: {
      url: process.env.RPC_URL ?? (() => { throw new Error("RPC_URL environment variable is not set"); })(),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      type: "http",
    },
  },
};

export default config;

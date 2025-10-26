import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import hardhatIgnitionEthers from "@nomicfoundation/hardhat-ignition-ethers";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const config: HardhatUserConfig = {
    plugins: [
        hardhatToolboxMochaEthers,
        hardhatEthers,
        hardhatIgnitionEthers,
        hardhatVerify,
    ],
    solidity: "0.8.28",
    networks: {
        localhost: {
            url: "http://127.0.0.1:8545",
            type: "http",
        },
        sepolia: {
            url: "https://eth-sepolia.g.alchemy.com/v2/CtjrnAb66z8l9qFZ0ib4u",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 11155111,
            type: "http",
        },
    },
    verify: {
        etherscan: {
            apiKey: process.env.ETHERSCAN_API_KEY || "",
        },
    },
};

export default config;

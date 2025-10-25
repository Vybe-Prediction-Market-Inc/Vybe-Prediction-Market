require("@nomicfoundation/hardhat-toolbox");
require("dotenv/config");

const DEFAULT_CHAIN_ID = 11155111;
const resolvedChainId = (() => {
    const raw = process.env.CHAIN_ID;
    if (!raw) return DEFAULT_CHAIN_ID;
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : DEFAULT_CHAIN_ID;
})();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.28",
    networks: {
        localhost: {
            url: "http://127.0.0.1:8545",
        },
        hardhat: {},
        sepolia: {
            url: process.env.RPC_URL,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: resolvedChainId,
        },
    },
};

// Resolve a market and print the Resolved event + final state
const hre = require("hardhat");

async function main() {
    const network = hre.network?.name || "unknown";
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const [deployer, oracle] = await hre.ethers.getSigners();

    // Inputs
    const addr = process.env.MARKET_ADDRESS;
    const marketId = Number(process.env.MARKET_ID || "1");
    const observed = BigInt(process.env.OBSERVED || "100000");

    if (!addr || !addr.startsWith("0x")) {
        throw new Error(
            "Set MARKET_ADDRESS=0x... to the deployed VybePredictionMarket address"
        );
    }
    if (Number.isNaN(marketId) || marketId <= 0) {
        throw new Error("MARKET_ID must be a positive integer");
    }
    if (observed < 0n) {
        throw new Error("OBSERVED must be a non-negative integer");
    }

    // Sanity: code at address
    const code = await hre.ethers.provider.getCode(addr);
    if (!code || code === "0x") {
        throw new Error(
            `No contract code found at ${addr} on network ${network} (chainId=${chainId}). Are you on the right network?`
        );
    }

    // Use the compiled contract ABI (gives us interface for decoding events)
    const vybe = await hre.ethers.getContractAt("VybePredictionMarket", addr);

    // Check oracle matches our signer
    const configuredOracle = await vybe.oracle();
    const oracleSigner = oracle || deployer;
    if (configuredOracle.toLowerCase() !== oracleSigner.address.toLowerCase()) {
        console.warn(
            `Warning: current oracle(${configuredOracle}) != signer(${oracleSigner.address}). resolveMarket will revert with 'not oracle'.`
        );
    }

    // Check market/deadline
    const before = await vybe.getMarket(marketId);
    const deadline = Number(before[3]);
    const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
    if (now < deadline) {
        console.warn(
            `Warning: now(${now}) < deadline(${deadline}). resolveMarket will revert with 'before deadline'.`
        );
    }
    console.log(
        `Network=${network} (chainId=${chainId})\nContract=${addr}\nMarketId=${marketId}\nObserved=${observed.toString()}`
    );

    // Resolve
    const tx = await vybe
        .connect(oracleSigner)
        .resolveMarket(marketId, observed);
    const rcpt = await tx.wait();
    console.log(`TxHash=${rcpt.hash} Block=${rcpt.blockNumber}`);

    // Decode Resolved event from receipt logs
    const event = rcpt.logs
        .map((l) => {
            try {
                return vybe.interface.parseLog(l);
            } catch {
                return null;
            }
        })
        .find((p) => p && p.name === "Resolved");
    if (event) {
        const { marketId: evId, outcomeYes, yesPool, noPool } = event.args;
        console.log(
            `Resolved event: marketId=${evId.toString()} outcomeYes=${outcomeYes} yesPool=${yesPool.toString()} noPool=${noPool.toString()}`
        );
    } else {
        console.warn(
            "Resolved event not found in receipt logs. Verify ABI/network and filters."
        );
    }

    // Final state
    const after = await vybe.getMarket(marketId);
    console.log(
        `Final state -> resolved=${after[4]} outcomeYes=${
            after[5]
        } yesPool=${after[6].toString()} noPool=${after[7].toString()}`
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

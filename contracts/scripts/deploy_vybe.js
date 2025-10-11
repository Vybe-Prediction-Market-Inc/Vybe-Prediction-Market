const hre = require("hardhat");

async function main() {
    const [deployer, oracle] = await hre.ethers.getSigners();
    const Vybe = await hre.ethers.getContractFactory("VybePredictionMarket");
    const vybe = await Vybe.deploy(oracle.address);
    await vybe.waitForDeployment();
    console.log("VybePredictionMarket:", await vybe.getAddress());

    const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
    const deadline = now + 3600; // 1 hour from now
    const tx = await vybe.createMarket(
        "Will this track hit popularity >= 80 in 1h?",
        process.env.TRACK_ID || "4uLU6hMCjMI75M1A2tKUQC",
        80,
        deadline
    );
    const rcpt = await tx.wait();
    // MarketId is marketCount after creation
    const marketId = await vybe.marketCount();
    console.log("Demo market created:", marketId.toString());
    console.log("Deadline:", deadline);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

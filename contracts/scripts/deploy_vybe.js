const hre = require("hardhat");

async function main() {
    const signers = await hre.ethers.getSigners();
    const deployer = signers[0];
    const oracle = signers[1] || signers[0]; // if only one account, use deployer as oracle
    const Vybe = await hre.ethers.getContractFactory("VybePredictionMarket");
    const vybe = await Vybe.deploy(oracle.address);
    await vybe.waitForDeployment();
    console.log("VybePredictionMarket:", await vybe.getAddress());
    console.log("Deployer:", deployer.address);
    console.log("Oracle:", oracle.address);

    const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
    const seconds = Number(process.env.DEADLINE_SECS || "300"); // default 5 minutes
    const deadline = now + seconds;
    const tx = await vybe.createMarket(
        `Will this track hit popularity >= 80 in ${seconds}s?`,
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

const hre = require("hardhat");

async function main() {
  console.log(`Deploying VybePredictionMarket to ${hre.network.name}`);

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  // Use deployer as oracle if no second signer
  const oracle = signers.length > 1 ? signers[1] : deployer;

  console.log("Deployer:", deployer.address);
  console.log("Oracle:", oracle.address);

  // Deploy contract
  const Vybe = await hre.ethers.getContractFactory("VybePredictionMarket");
  const vybe = await Vybe.deploy(oracle.address);
  await vybe.waitForDeployment();

  console.log("VybePredictionMarket deployed at:", await vybe.getAddress());

  // Create a demo market
  const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const seconds = Number(process.env.DEADLINE_SECS || "300"); // 5 minutes default
  const deadline = now + seconds;

  const tx = await vybe.createMarket(
    `Will this track hit popularity >= 80 in ${seconds}s?`,
    process.env.TRACK_ID || "4uLU6hMCjMI75M1A2tKUQC",
    80,
    deadline
  );
  await tx.wait();

  const marketId = await vybe.marketCount();
  console.log("Demo market created:", marketId.toString());
  console.log("Deadline:", deadline);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});

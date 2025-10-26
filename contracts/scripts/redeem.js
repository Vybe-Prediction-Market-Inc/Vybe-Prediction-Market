import hre from "hardhat";

async function main() {
  // Connect explicitly to the network (Hardhat 3)
  const connection = await hre.network.connect();

  const [deployer, oracle, alice] = await connection.ethers.getSigners();
  const provider = connection.ethers.provider;

  const addr = process.env.MARKET_ADDRESS;
  const marketId = Number(process.env.MARKET_ID || "1");
  if (!addr) {
    throw new Error("MARKET_ADDRESS env var required");
  }

  const ABI = ["function redeem(uint256)"];
  const vybe = new connection.ethers.Contract(addr, ABI, provider);

  console.log(
    `Redeeming market #${marketId} on contract ${addr} using ${alice.address}`
  );

  const tx = await vybe.connect(alice || deployer).redeem(marketId);
  const rcpt = await tx.wait();

  console.log("Redeemed ->", rcpt.hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import hre from "hardhat";

async function main() {
    const [deployer, oracle, alice] = await hre.ethers.getSigners();
    const addr = process.env.MARKET_ADDRESS;
    const marketId = Number(process.env.MARKET_ID || "1");
    if (!addr) throw new Error("MARKET_ADDRESS env var required");
    const abi = ["function redeem(uint256)"];
    const vybe = new hre.ethers.Contract(addr, abi, hre.ethers.provider);
    const tx = await vybe.connect(alice || deployer).redeem(marketId);
    const rcpt = await tx.wait();
    console.log("Redeemed ->", rcpt.hash);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

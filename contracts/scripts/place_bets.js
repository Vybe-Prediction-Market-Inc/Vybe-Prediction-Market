const hre = require("hardhat");

async function main() {
    const [deployer, oracle, alice, bob] = await hre.ethers.getSigners();
    const addr = process.env.MARKET_ADDRESS;
    const marketId = Number(process.env.MARKET_ID || "1");
    if (!addr) throw new Error("MARKET_ADDRESS env var required");
    const abi = [
        "function buyYes(uint256) payable",
        "function buyNo(uint256) payable",
    ];
    const vybe = new hre.ethers.Contract(addr, abi, hre.ethers.provider);

    const yesTx = await vybe
        .connect(alice || deployer)
        .buyYes(marketId, { value: hre.ethers.parseEther("0.1") });
    await yesTx.wait();
    console.log("Alice YES 0.1 ETH ->", yesTx.hash);

    const noTx = await vybe
        .connect(bob || deployer)
        .buyNo(marketId, { value: hre.ethers.parseEther("0.2") });
    await noTx.wait();
    console.log("Bob NO 0.2 ETH ->", noTx.hash);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

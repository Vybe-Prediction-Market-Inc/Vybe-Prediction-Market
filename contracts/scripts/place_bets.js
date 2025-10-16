const hre = require("hardhat");

async function main() {
    const networkName = hre.network?.name || "unknown";
    console.log(`Using network: ${networkName}`);

    const [deployer, oracle, alice, bob] = await hre.ethers.getSigners();

    const addr = process.env.MARKET_ADDRESS;
    const marketId = Number(process.env.MARKET_ID || "1");
    const yesEth = process.env.YES_ETH || "0.1";
    const noEth = process.env.NO_ETH || "0.2";

    if (!addr) {
        throw new Error(
            "MARKET_ADDRESS env var required. Tip: copy the address printed by scripts/deploy_vybe.js and run: MARKET_ADDRESS=<addr> npx hardhat run scripts/place_bets.js --network localhost"
        );
    }

    // Ensure the contract exists at this address on the current network
    const code = await hre.ethers.provider.getCode(addr);
    if (!code || code === "0x") {
        throw new Error(
            `No contract code at ${addr} on network "${networkName}".\n` +
                `- Did you deploy to this network? (e.g. npx hardhat run scripts/deploy_vybe.js --network localhost)\n` +
                `- Are you running the external node? (e.g. npx hardhat node --port 8545 --hostname 127.0.0.1)\n` +
                `- Are you passing --network localhost when running this script?`
        );
    }

    const abi = [
        "function buyYes(uint256) payable",
        "function buyNo(uint256) payable",
    ];
    const vybe = new hre.ethers.Contract(addr, abi, hre.ethers.provider);

    console.log(`Placing bets on marketId=${marketId} at ${addr} ...`);
    const yesTx = await vybe
        .connect(alice || deployer)
        .buyYes(marketId, { value: hre.ethers.parseEther(yesEth) });
    await yesTx.wait();
    console.log(`Alice YES ${yesEth} ETH ->`, yesTx.hash);

    const noTx = await vybe
        .connect(bob || deployer)
        .buyNo(marketId, { value: hre.ethers.parseEther(noEth) });
    await noTx.wait();
    console.log(`Bob NO ${noEth} ETH ->`, noTx.hash);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

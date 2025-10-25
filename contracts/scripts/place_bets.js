import hre from "hardhat";

async function main() {
  // Connect to network (Hardhat 3)
  const connection = await hre.network.connect();
  const [deployer, oracle, alice, bob] = await connection.ethers.getSigners();
  const provider = connection.ethers.provider;

  const networkName = hre.network?.name || "unknown";
  console.log(`Using network: ${networkName}`);

  const addr = process.env.MARKET_ADDRESS;
  const marketId = Number(process.env.MARKET_ID || "1");
  const yesEth = process.env.YES_ETH || "0.1";
  const noEth = process.env.NO_ETH || "0.2";

  if (!addr) {
    throw new Error(
      "MARKET_ADDRESS env var required.\n" +
        "Tip: copy the address printed by scripts/deploy_vybe.js and run:\n" +
        "MARKET_ADDRESS=<addr> npx hardhat run scripts/place_bets.js --network localhost"
    );
  }

  // ✅ Ensure contract exists on-chain
  const code = await provider.getCode(addr);
  if (!code || code === "0x") {
    throw new Error(
      `No contract code at ${addr} on network "${networkName}".\n` +
        `- Did you deploy to this network?\n` +
        `- Are you running an external node? (npx hardhat node --port 8545)\n` +
        `- Are you passing --network localhost?`
    );
  }

  const ABI = [
    "function buyYes(uint256) payable",
    "function buyNo(uint256) payable",
  ];
  const vybe = new connection.ethers.Contract(addr, ABI, provider);

  console.log(`Placing bets on marketId=${marketId} at ${addr} ...`);

  const yesTx = await vybe
    .connect(alice || deployer)
    .buyYes(marketId, { value: connection.ethers.parseEther(yesEth) });
  await yesTx.wait();
  console.log(`Alice YES ${yesEth} ETH ->`, yesTx.hash);

  const noTx = await vybe
    .connect(bob || deployer)
    .buyNo(marketId, { value: connection.ethers.parseEther(noEth) });
  await noTx.wait();
  console.log(`Bob NO ${noEth} ETH ->`, noTx.hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

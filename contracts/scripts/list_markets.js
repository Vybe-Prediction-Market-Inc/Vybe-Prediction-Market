import hre from "hardhat";

async function main() {
  // Connect to active network (Hardhat 3)
  const connection = await hre.network.connect();
  const [deployer] = await connection.ethers.getSigners();
  const provider = connection.ethers.provider;

  const filterByDeployer =
    (process.env.FILTER_BY_DEPLOYER ?? "true").toLowerCase() !== "false";

  // Scan recent blocks for contracts created by the deployer (like the frontend)
  const latest = await provider.getBlockNumber();
  const maxBlocks = Number(process.env.SCAN_BLOCKS || 2000);
  const startEnv = process.env.START_BLOCK
    ? Number(process.env.START_BLOCK)
    : undefined;
  const start =
    startEnv !== undefined
      ? startEnv
      : latest > maxBlocks
      ? latest - maxBlocks
      : 0;

  const created = new Set();
  const discovered = new Set();

  // 1) Primary discovery via logs
  try {
    const topic0 = connection.ethers.id(
      "MarketCreated(uint256,string,string,uint256,uint256)"
    );
    const logs = await provider.getLogs({
      fromBlock: start,
      toBlock: latest,
      topics: [topic0],
    });
    for (const l of logs) discovered.add(l.address);
  } catch (e) {
    // ignore errors
  }

  // 2) Fallback: scan blocks for contract creations by deployer
  for (let bn = start; bn <= latest; bn++) {
    const block = await provider.getBlock(bn);
    if (!block?.transactions) continue;
    for (const txHash of block.transactions) {
      const tx = await provider.getTransaction(txHash);
      if (!tx) continue;
      const isCreation = tx.to === null;
      if (!isCreation) continue;
      if (
        filterByDeployer &&
        tx.from?.toLowerCase() !== deployer.address.toLowerCase()
      )
        continue;

      const rcpt = await provider.getTransactionReceipt(txHash);
      if (!rcpt?.contractAddress) continue;
      created.add(rcpt.contractAddress);
    }
  }

  const addresses = new Set([...discovered, ...created]);

  if (addresses.size === 0) {
    console.log(
      `No Vybe markets discovered. Searched logs from block ${start} to ${latest}, and` +
        (filterByDeployer
          ? ` creations by ${deployer.address}.`
          : " contract creations.")
    );
    console.log(
      "Hints: set START_BLOCK or SCAN_BLOCKS, ensure you deployed on this node, or try FILTER_BY_DEPLOYER=false"
    );
    return;
  }

  const ABI = [
    "function marketCount() view returns (uint256)",
    "function getMarket(uint256) view returns (string question, string trackId, uint256 threshold, uint256 deadline, bool resolved, bool outcomeYes, uint256 yesPool, uint256 noPool)",
  ];

  console.log(`Found ${addresses.size} contract(s):`);
  for (const addr of addresses) {
    const code = await provider.getCode(addr);
    if (!code || code === "0x") continue;

    const c = new connection.ethers.Contract(addr, ABI, provider);
    try {
      const mc = await c.marketCount();
      console.log(`\nContract ${addr} (markets: ${mc})`);
      const total = Number(mc);
      for (let i = 1; i <= total; i++) {
        const m = await c.getMarket(i);
        console.log(`- #${i}: ${m.question}`);
      }
    } catch {
      // not a readable VybePredictionMarket
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

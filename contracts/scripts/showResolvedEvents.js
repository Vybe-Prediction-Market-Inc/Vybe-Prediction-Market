// Print all Resolved events for a VybePredictionMarket
const hre = require("hardhat");

async function main() {
  const addr = process.env.MARKET_ADDRESS;
  const from = process.env.FROM_BLOCK ? BigInt(process.env.FROM_BLOCK) : 0n;
  const to = process.env.TO_BLOCK ? BigInt(process.env.TO_BLOCK) : (await hre.ethers.provider.getBlockNumber());
  if (!addr) throw new Error("Set MARKET_ADDRESS=0x...");

  const vybe = await hre.ethers.getContractAt("VybePredictionMarket", addr);
  const event = vybe.interface.getEvent("Resolved");
  const topic = vybe.interface.getEventTopic(event);

  const logs = await hre.ethers.provider.getLogs({
    address: addr,
    fromBlock: from,
    toBlock: to,
    topics: [topic],
  });

  if (logs.length === 0) {
    console.log("No Resolved events found for", addr, "in blocks", from.toString(), "..", to.toString());
    return;
  }

  for (const l of logs) {
    const parsed = vybe.interface.parseLog(l);
    const { marketId, outcomeYes, yesPool, noPool } = parsed.args;
    console.log(`Block=${l.blockNumber} Tx=${l.transactionHash} marketId=${marketId} outcomeYes=${outcomeYes} yesPool=${yesPool} noPool=${noPool}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

// Print all Resolved events for a VybePredictionMarket
import hre from "hardhat";

async function main() {
  // Connect explicitly to the current network (Hardhat 3)
  const connection = await hre.network.connect();
  const provider = connection.ethers.provider;

  const addr = process.env.MARKET_ADDRESS;
  const from =
    process.env.FROM_BLOCK !== undefined
      ? BigInt(process.env.FROM_BLOCK)
      : 0n;

  const latestBlock = await provider.getBlockNumber();
  const to =
    process.env.TO_BLOCK !== undefined
      ? BigInt(process.env.TO_BLOCK)
      : BigInt(latestBlock);

  if (!addr) throw new Error("Set MARKET_ADDRESS=0x...");

  // Load contract and interface for decoding logs
  const vybe = await connection.ethers.getContractAt("VybePredictionMarket", addr);
  const resolvedEvent = vybe.interface.getEvent("Resolved");
  const topic = vybe.interface.getEventTopic(resolvedEvent);

  // Fetch logs for this event
  const logs = await provider.getLogs({
    address: addr,
    fromBlock: from,
    toBlock: to,
    topics: [topic],
  });

  if (logs.length === 0) {
    console.log(
      `No Resolved events found for ${addr} between blocks ${from.toString()} .. ${to.toString()}`
    );
    return;
  }

  console.log(`Found ${logs.length} Resolved events for contract ${addr}:`);
  for (const log of logs) {
    const parsed = vybe.interface.parseLog(log);
    const { marketId, outcomeYes, yesPool, noPool } = parsed.args;
    console.log(
      `Block=${log.blockNumber} Tx=${log.transactionHash}\n  marketId=${marketId}\n  outcomeYes=${outcomeYes}\n  yesPool=${yesPool}\n  noPool=${noPool}\n`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

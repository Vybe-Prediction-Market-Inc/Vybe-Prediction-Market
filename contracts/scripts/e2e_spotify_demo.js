import hre from "hardhat";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";

// Load env variables from project root, then local override
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config();

const RAPIDAPI_HOST =
  process.env.RAPIDAPI_HOST ||
  "spotify-track-streams-playback-count1.p.rapidapi.com";

function extractPlaybackCount(payload) {
  const candidates = [
    payload?.spotify_track_streams?.streams,
    payload?.spotify_track_streams?.playback_count,
    payload?.spotify_track_streams?.total_streams,
    payload?.data?.streams,
    payload?.data?.playback_count,
    payload?.data?.total_streams,
    payload?.streams,
    payload?.playback_count,
    payload?.total_streams,
  ];
  for (const v of candidates) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  throw new Error(
    `Playback count not found: ${JSON.stringify(payload).slice(0, 200)}`
  );
}

async function fetchPlaybackCount(trackId) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error("Set RAPIDAPI_KEY");
  }

  const url = new URL(`https://${RAPIDAPI_HOST}/tracks/spotify_track_streams`);
  url.searchParams.set("spotify_track_id", trackId);

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `RapidAPI playback error: ${res.status} ${res.statusText} ${text}`
    );
  }

  const json = await res.json();
  return extractPlaybackCount(json);
}

async function main() {
  // Connect explicitly (Hardhat 3 pattern)
  const connection = await hre.network.connect();

  const [deployer, oracle, alice, bob] = await connection.ethers.getSigners();

  const Vybe = await connection.ethers.getContractFactory("VybePredictionMarket");
  const vybe = await Vybe.deploy(oracle.address);
  await vybe.waitForDeployment();
  const addr = await vybe.getAddress();
  console.log("VybePredictionMarket:", addr);

  // Params
  const trackId = process.env.TRACK_ID || "4ubwzNjqHGaZZ5k06PDx1H";
  const threshold = Number(process.env.THRESHOLD || "100000");

  // Create market
  const latest = await connection.ethers.provider.getBlock("latest");
  const deadline = latest.timestamp + 5;
  await (
    await vybe.createMarket(
      `Will this track hit playback count >= ${threshold}?`,
      trackId,
      threshold,
      deadline
    )
  ).wait();
  const marketId = await vybe.marketCount();
  console.log("Market created:", marketId.toString(), "deadline:", deadline);

  // Bets
  await (
    await vybe
      .connect(alice)
      .buyYes(marketId, { value: connection.ethers.parseEther("0.1") })
  ).wait();
  await (
    await vybe
      .connect(bob)
      .buyNo(marketId, { value: connection.ethers.parseEther("0.2") })
  ).wait();
  console.log("Bets placed: Alice YES 0.1, Bob NO 0.2");

  // Fast‑forward
  await connection.ethers.provider.send("evm_setNextBlockTimestamp", [
    deadline + 1,
  ]);
  await connection.ethers.provider.send("evm_mine", []);

  // Resolve market
  const playbackCount = await fetchPlaybackCount(trackId);
  console.log(`Playback count for ${trackId}:`, playbackCount);
  await (
    await vybe.connect(oracle).resolveMarket(marketId, playbackCount)
  ).wait();
  console.log("Resolved using RapidAPI playback data.");

  // Redemption
  const outcomeYes = playbackCount >= threshold;
  if (outcomeYes) {
    const before = await connection.ethers.provider.getBalance(alice.address);
    const rcpt = await (await vybe.connect(alice).redeem(marketId)).wait();
    const after = await connection.ethers.provider.getBalance(alice.address);
    console.log(
      "Alice redeemed ->",
      rcpt.hash,
      "delta:",
      (after - before).toString(),
      "wei"
    );
  } else {
    const before = await connection.ethers.provider.getBalance(bob.address);
    const rcpt = await (await vybe.connect(bob).redeem(marketId)).wait();
    const after = await connection.ethers.provider.getBalance(bob.address);
    console.log(
      "Bob redeemed ->",
      rcpt.hash,
      "delta:",
      (after - before).toString(),
      "wei"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

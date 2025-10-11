import "dotenv/config";
import axios from "axios";
import { ethers } from "ethers";

async function fetchSpotifyStreams(trackId) {
    const token = process.env.SPOTIFY_TOKEN; // for hackathon, you can generate manually
    const res = await axios.get(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );
    const streams = res.data.popularity; // Simplified proxy for hackathon
    console.log(`Track ${trackId} has ${streams} popularity`);
    return streams;
}

async function postToOracleContract(marketAddress, value) {
    const rpc = process.env.RPC_URL;
    const pk = process.env.PRIVATE_KEY;
    if (!rpc || !pk) throw new Error("Missing RPC_URL or PRIVATE_KEY");
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);

    const abi = [
        "function resolveMarket(uint256 marketId, uint256 observed) external",
    ];
    const marketId = Number(process.env.MARKET_ID || 1);
    const contract = new ethers.Contract(marketAddress, abi, wallet);
    console.log(`Resolving market ${marketId} with observed=${value}...`);
    const tx = await contract.resolveMarket(marketId, value);
    const rcpt = await tx.wait();
    console.log("Resolved in tx", rcpt.transactionHash);
}

async function main() {
    const trackId = process.env.TRACK_ID || "4uLU6hMCjMI75M1A2tKUQC";
    const marketAddress = process.env.MARKET_ADDRESS;
    if (!marketAddress) throw new Error("Missing MARKET_ADDRESS");
    const popularity = await fetchSpotifyStreams(trackId);
    await postToOracleContract(marketAddress, popularity);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

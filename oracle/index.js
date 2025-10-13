import dotenv from "dotenv";
import axios from "axios";
import { ethers } from "ethers";

dotenv.config();

async function getSpotifyToken() {
    // If a pre-fetched access token is provided, prefer it (faster for demos)
    if (process.env.SPOTIFY_ACCESS_TOKEN) {
        return process.env.SPOTIFY_ACCESS_TOKEN;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            "Missing SPOTIFY_ACCESS_TOKEN or SPOTIFY_CLIENT_ID/SECRET"
        );
    }

    const data = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
    });

    const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        data,
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );

    return response.data.access_token;
}

async function fetchSpotifyStreams(trackId) {
    const tryFetch = async (token) =>
        axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

    // First attempt using provided token or client credentials
    let token = await getSpotifyToken();
    try {
        const res = await tryFetch(token);
        const popularity = res.data.popularity;
        console.log(`Track ${trackId} has ${popularity} popularity`);
        return popularity;
    } catch (err) {
        const status = err?.response?.status;
        const hasClientCreds = !!(
            process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
        );
        const hadAccessToken = !!process.env.SPOTIFY_ACCESS_TOKEN;
        if (status === 401 && hasClientCreds && hadAccessToken) {
            // Fallback: fetch a fresh token via client credentials and retry once
            const data = new URLSearchParams({
                grant_type: "client_credentials",
                client_id: process.env.SPOTIFY_CLIENT_ID,
                client_secret: process.env.SPOTIFY_CLIENT_SECRET,
            });
            const resp = await axios.post(
                "https://accounts.spotify.com/api/token",
                data,
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );
            token = resp.data.access_token;
            const res2 = await tryFetch(token);
            const popularity = res2.data.popularity;
            console.log(
                `Track ${trackId} has ${popularity} popularity (refreshed token)`
            );
            return popularity;
        }
        throw err;
    }
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
    console.log("Resolved in tx", rcpt.hash);
}

async function main() {
    const trackId = process.env.TRACK_ID || "4uLU6hMCjMI75M1A2tKUQC";
    const marketAddress = process.env.MARKET_ADDRESS;
    if (!marketAddress) throw new Error("Missing MARKET_ADDRESS");

    const override = process.env.OBSERVED_OVERRIDE;
    if (override !== undefined) {
        console.log(
            `Using OBSERVED_OVERRIDE=${override}, skipping Spotify fetch`
        );
        await postToOracleContract(marketAddress, Number(override));
        return;
    }

    const popularity = await fetchSpotifyStreams(trackId);
    await postToOracleContract(marketAddress, popularity);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

const hre = require("hardhat");
const axios = require("axios");
const { URLSearchParams } = require("url");
require("dotenv/config");

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";

function resolveInputs() {
    const [, , argQuestion, argSong, argArtist, argThreshold, argDeadlineSecs] =
        process.argv;
    const question = process.env.QUESTION || argQuestion || null;
    const songName = process.env.SONG_NAME || argSong;
    const artistName = process.env.ARTIST_NAME || argArtist;
    const thresholdRaw = process.env.THRESHOLD || argThreshold;
    const deadlineSecsRaw =
        process.env.DEADLINE_SECS ||
        process.env.DURATION ||
        argDeadlineSecs;

    if (!songName || !artistName) {
        throw new Error(
            "Provide SONG_NAME and ARTIST_NAME env vars (or pass them as positional args after the optional question)."
        );
    }
    if (!thresholdRaw) {
        throw new Error(
            "Provide THRESHOLD (env) or pass it as the 4th positional argument (uint256)."
        );
    }
    if (!deadlineSecsRaw) {
        throw new Error(
            "Provide DEADLINE_SECS (env) or pass it as the 5th positional argument (seconds from now)."
        );
    }

    const threshold = BigInt(thresholdRaw);
    if (threshold <= 0n) {
        throw new Error("THRESHOLD must be a positive integer.");
    }

    const deadlineSeconds = Number(deadlineSecsRaw);
    if (!Number.isFinite(deadlineSeconds) || deadlineSeconds <= 0) {
        throw new Error("DEADLINE_SECS must be a positive integer (seconds).");
    }

    return { question, songName, artistName, threshold, deadlineSeconds };
}

async function fetchClientCredentialsToken() {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) {
        throw new Error(
            "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET (or SPOTIFY_ACCESS_TOKEN)."
        );
    }

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: id,
        client_secret: secret,
    });
    const res = await axios.post(SPOTIFY_TOKEN_URL, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return res.data.access_token;
}

async function getSpotifyToken() {
    if (process.env.SPOTIFY_ACCESS_TOKEN) {
        return process.env.SPOTIFY_ACCESS_TOKEN;
    }
    return fetchClientCredentialsToken();
}

async function searchTrack(songName, artistName) {
    let token = await getSpotifyToken();
    const hadAccessToken = !!process.env.SPOTIFY_ACCESS_TOKEN;
    const hasClientCreds = !!(
        process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
    );

    const queryTrack = async (authToken) => {
        try {
            const response = await axios.get(SPOTIFY_SEARCH_URL, {
                params: {
                    q: `track:${songName} artist:${artistName}`,
                    type: "track",
                    limit: 1,
                },
                headers: { Authorization: `Bearer ${authToken}` },
            });
            const [track] = response.data?.tracks?.items || [];
            if (!track) {
                throw new Error(
                    `No Spotify track found for "${songName}" by "${artistName}".`
                );
            }
            return track;
        } catch (err) {
            const status = err?.response?.status;
            if (status === 401 && hasClientCreds && hadAccessToken) {
                token = await fetchClientCredentialsToken();
                return queryTrack(token);
            }
            const detail =
                err?.response?.data?.error?.message ||
                err?.response?.data ||
                err.message;
            throw new Error(
                `Spotify search error (${status ?? "unknown"}): ${detail}`
            );
        }
    };

    return queryTrack(token);
}

async function main() {
    const network = hre.network?.name || "unknown";
    const contractAddress =
        process.env.MARKET_ADDRESS ||
        process.env.VYBE_CONTRACT_ADDRESS ||
        process.env.CONTRACT_ADDRESS;

    if (!contractAddress || !contractAddress.startsWith("0x")) {
        throw new Error(
            "Set MARKET_ADDRESS (or VYBE_CONTRACT_ADDRESS) to the deployed VybePredictionMarket address."
        );
    }

    const provider = hre.ethers.provider;
    const code = await provider.getCode(contractAddress);
    if (!code || code === "0x") {
        throw new Error(
            `No contract found at ${contractAddress} on ${network}. Check your --network flag or env RPC.`
        );
    }

    const {
        question: providedQuestion,
        songName,
        artistName,
        threshold,
        deadlineSeconds,
    } =
        resolveInputs();

    console.log(
        `Looking up Spotify track for "${songName}" by "${artistName}"...`
    );
    const track = await searchTrack(songName, artistName);
    const trackId = track.id;
    const canonicalName = track.name;
    const artistList = (track.artists || []).map((a) => a.name).join(", ");

    const latestBlock = await provider.getBlock("latest");
    const now = latestBlock.timestamp;
    const deadline = now + Number(deadlineSeconds);

    const finalQuestion =
        providedQuestion ||
        `Will "${canonicalName}" by ${artistList} hit playback count >= ${threshold.toString()} in ${deadlineSeconds} seconds?`;

    const [owner] = await hre.ethers.getSigners();
    const vybe = await hre.ethers.getContractAt(
        "VybePredictionMarket",
        contractAddress
    );

    console.log(
        [
            `Network: ${network}`,
            `Contract: ${contractAddress}`,
            `Owner signer: ${owner.address}`,
            `Question: ${finalQuestion}`,
            `Track ID: ${trackId}`,
            `Threshold: ${threshold.toString()}`,
            `Deadline: ${deadline} (now=${now}, +${deadlineSeconds}s)`,
        ].join("\n")
    );

    const tx = await vybe
        .connect(owner)
        .createMarket(finalQuestion, trackId, threshold, deadline);
    const receipt = await tx.wait();
    const marketId = await vybe.marketCount();
    console.log(
        `Market created! marketId=${marketId.toString()} txHash=${receipt.hash} block=${receipt.blockNumber}`
    );
}

main().catch((err) => {
    console.error("createMarket failed:", err);
    process.exit(1);
});

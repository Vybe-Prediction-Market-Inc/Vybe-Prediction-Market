const hre = require("hardhat");
const axios = require("axios");
const { URLSearchParams } = require("url");

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";

function resolveInputs() {
    const [, , argSong, argArtist] = process.argv;
    const songName = process.env.SONG_NAME || argSong;
    const artistName = process.env.ARTIST_NAME || argArtist;
    if (!songName || !artistName) {
        throw new Error(
            "Provide SONG_NAME and ARTIST_NAME env vars (or pass them as arguments)."
        );
    }
    return { songName, artistName };
}

async function fetchClientCredentialsToken() {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) {
        throw new Error(
            "Set SPOTIFY_ACCESS_TOKEN or SPOTIFY_CLIENT_ID/SECRET to look up tracks."
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
    const { songName, artistName } = resolveInputs();
    console.log(
        `Searching Spotify track for song="${songName}" artist="${artistName}"...`
    );
    const track = await searchTrack(songName, artistName);
    const trackId = track.id;
    const canonicalName = track.name;
    const primaryArtists = (track.artists || []).map((a) => a.name).join(", ");
    console.log(
        `Found track: ${canonicalName} by ${primaryArtists} (id=${trackId})`
    );

    const signers = await hre.ethers.getSigners();
    const deployer = signers[0];
    const oracle = signers[1] || signers[0]; // if only one account, use deployer as oracle
    const Vybe = await hre.ethers.getContractFactory("VybePredictionMarket");
    const vybe = await Vybe.deploy(oracle.address);
    await vybe.waitForDeployment();
    console.log("VybePredictionMarket:", await vybe.getAddress());
    console.log("Deployer:", deployer.address);
    console.log("Oracle:", oracle.address);

    const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
    const seconds = Number(process.env.DEADLINE_SECS || "300"); // default 5 minutes
    const deadline = now + seconds;
    const threshold = Number(process.env.THRESHOLD || "100000");
    const question = `Will "${canonicalName}" by ${primaryArtists} hit playback count >= ${threshold} in ${seconds}s?`;
    const tx = await vybe.createMarket(question, trackId, threshold, deadline);
    const rcpt = await tx.wait();
    const marketId = await vybe.marketCount();
    console.log("Demo market created:", marketId.toString());
    console.log("Track ID:", trackId);
    console.log("Question:", question);
    console.log("Deadline:", deadline);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});

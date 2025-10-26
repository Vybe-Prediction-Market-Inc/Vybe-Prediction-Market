import hre from "hardhat";
import axios from "axios";
import { URLSearchParams } from "url";
import fs from "fs";
import path from "path";
import "dotenv/config";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";
const HARDCODED_MARKET_BATCH = [
    {
        songName: "Headlines",
        artistName: "Drake",
        threshold: "1000000000",
        deadlineSeconds: 86400,
        question: 'Will "" by Drake hit 1 billion plays in a day?',
    },
    {
        songName: "Feliz me siento",
        artistName: "gunda merced y su salsa fever",
        threshold: "9000000",
        deadlineSeconds: 604800,
        question:
            'Will "Feliz me siento" by Gunda Merced y su Salsa Fever hit 9 million plays in a week',
    },
];

function getFlagValue(flag) {
    const prefix = `${flag}=`;
    const arg = process.argv.find((entry) => entry.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
}

function getPositionalArgs() {
    return process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
}

function resolveInputs() {
    const [argQuestion, argSong, argArtist, argThreshold, argDeadlineSecs] =
        getPositionalArgs();
    const question = process.env.QUESTION || argQuestion || null;
    const songName = process.env.SONG_NAME || argSong;
    const artistName = process.env.ARTIST_NAME || argArtist;
    const thresholdRaw = process.env.THRESHOLD || argThreshold;
    const deadlineSecsRaw =
        process.env.DEADLINE_SECS || process.env.DURATION || argDeadlineSecs;

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

function resolveBatchSpecs() {
    if (HARDCODED_MARKET_BATCH.length > 0) {
        return HARDCODED_MARKET_BATCH.map((entry, idx) =>
            normalizeBatchEntry(entry, idx)
        );
    }

    const inlineFlag = getFlagValue("--markets");
    const inline = inlineFlag || process.env.MARKET_BATCH;
    const batchPath =
        getFlagValue("--batch") || process.env.MARKET_BATCH_FILE || null;

    let parsed = null;
    if (batchPath) {
        const absolute = path.isAbsolute(batchPath)
            ? batchPath
            : path.join(process.cwd(), batchPath);
        const raw = fs.readFileSync(absolute, "utf8");
        parsed = JSON.parse(raw);
    } else if (inline) {
        parsed = JSON.parse(inline);
    }

    if (!parsed) return [];
    if (!Array.isArray(parsed)) {
        throw new Error(
            "MARKET_BATCH(_FILE) must resolve to an array of market specs."
        );
    }

    return parsed.map((entry, idx) => normalizeBatchEntry(entry, idx));
}

function normalizeBatchEntry(entry, idx) {
    const songName = entry.songName || entry.song || entry.trackName;
    const artistName = entry.artistName || entry.artist;
    const thresholdRaw = entry.threshold;
    const deadlineSecondsRaw =
        entry.deadlineSecs ??
        entry.deadlineSeconds ??
        entry.durationSecs ??
        entry.duration;

    if (!songName || !artistName) {
        throw new Error(
            `Batch entry #${idx + 1} missing songName or artistName.`
        );
    }
    if (thresholdRaw === undefined || thresholdRaw === null) {
        throw new Error(`Batch entry #${idx + 1} missing threshold.`);
    }
    if (deadlineSecondsRaw === undefined || deadlineSecondsRaw === null) {
        throw new Error(`Batch entry #${idx + 1} missing deadlineSeconds.`);
    }

    const threshold = BigInt(thresholdRaw);
    if (threshold <= 0n) {
        throw new Error(`Batch entry #${idx + 1} has non-positive threshold.`);
    }

    const deadlineSeconds = Number(deadlineSecondsRaw);
    if (!Number.isFinite(deadlineSeconds) || deadlineSeconds <= 0) {
        throw new Error(
            `Batch entry #${
                idx + 1
            } must have a positive numeric deadlineSeconds.`
        );
    }

    return {
        question: entry.question || null,
        songName,
        artistName,
        threshold,
        deadlineSeconds,
    };
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
    const connection = await hre.network.connect();
    const network = connection.name ?? hre.network?.name ?? "unknown";
    const contractAddress =
        process.env.MARKET_ADDRESS ||
        process.env.VYBE_CONTRACT_ADDRESS ||
        process.env.CONTRACT_ADDRESS;

    if (!contractAddress || !contractAddress.startsWith("0x")) {
        throw new Error(
            "Set MARKET_ADDRESS (or VYBE_CONTRACT_ADDRESS) to the deployed VybePredictionMarket address."
        );
    }

    const provider = connection.ethers.provider;
    const code = await provider.getCode(contractAddress);
    if (!code || code === "0x") {
        throw new Error(
            `No contract found at ${contractAddress} on ${network}. Check your --network flag or env RPC.`
        );
    }

    const batchSpecs = resolveBatchSpecs();
    const singleSpec = batchSpecs.length === 0 ? [resolveInputs()] : batchSpecs;

    const [owner] = await connection.ethers.getSigners();
    const vybe = await connection.ethers.getContractAt(
        "VybePredictionMarket",
        contractAddress
    );

    for (let i = 0; i < singleSpec.length; i++) {
        const {
            question: providedQuestion,
            songName,
            artistName,
            threshold,
            deadlineSeconds,
        } = singleSpec[i];

        console.log(
            `\n[${i + 1}/${
                singleSpec.length
            }] Looking up Spotify track for "${songName}" by "${artistName}"...`
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
            `Market created! marketId=${marketId.toString()} txHash=${
                receipt.hash
            } block=${receipt.blockNumber}`
        );
    }
}

main().catch((err) => {
    console.error("createMarket failed:", err);
    process.exit(1);
});

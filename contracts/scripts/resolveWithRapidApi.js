import hre from "hardhat";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env first (repo/.env), then contracts/.env overrides if present.
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config();

const DEFAULT_RAPIDAPI_HOST =
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

    for (const value of candidates) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return Math.trunc(value);
        }
    }

    throw new Error(
        `Playback count missing in RapidAPI payload: ${JSON.stringify(
            payload
        ).slice(0, 300)}`
    );
}

async function fetchPlaybackCount({ trackId, isrc }) {
    if (!trackId) {
        throw new Error(
            "Track ID is required to query RapidAPI playback counts."
        );
    }
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
        throw new Error("Set RAPIDAPI_KEY with your RapidAPI credentials.");
    }

    const host = process.env.RAPIDAPI_HOST || DEFAULT_RAPIDAPI_HOST;
    const url = `https://${host}/tracks/spotify_track_streams`;
    const params = { spotify_track_id: trackId };
    if (isrc) params.isrc = isrc;

    const { data } = await axios.get(url, {
        params,
        headers: {
            "x-rapidapi-host": host,
            "x-rapidapi-key": apiKey,
        },
    });

    const playbackCount = extractPlaybackCount(data);
    console.log(
        `RapidAPI playback count for ${trackId}${
            isrc ? ` (ISRC ${isrc})` : ""
        }: ${playbackCount}`
    );
    return BigInt(playbackCount);
}

async function main() {
    const connection = await hre.network.connect();
    const provider = connection.ethers.provider;
    const [defaultSigner] = await connection.ethers.getSigners();
    const oracle = defaultSigner;

    const marketAddress = process.env.MARKET_ADDRESS;
    const marketId = Number(process.env.MARKET_ID || "1");
    const overrideTrackId = process.env.TRACK_ID;
    const trackIsrc = process.env.TRACK_ISRC || process.env.ISRC;

    if (!marketAddress || !marketAddress.startsWith("0x")) {
        throw new Error(
            "Set MARKET_ADDRESS=0x... for the VybePredictionMarket."
        );
    }
    if (!Number.isFinite(marketId) || marketId <= 0) {
        throw new Error("MARKET_ID must be a positive integer.");
    }

    const code = await provider.getCode(marketAddress);
    if (!code || code === "0x") {
        throw new Error(
            `No contract code found at ${marketAddress}. Check your network and address.`
        );
    }

    const vybe = await connection.ethers.getContractAt(
        "VybePredictionMarket",
        marketAddress
    );

    const network = await provider.getNetwork();
    console.log(
        `Resolving on chainId=${network.chainId} address=${marketAddress} marketId=${marketId}`
    );

    const market = await vybe.getMarket(marketId);
    const trackId = overrideTrackId || market[1];
    if (!trackId) {
        throw new Error(
            "Track ID missing on contract. Pass TRACK_ID env var explicitly."
        );
    }

    const deadline = Number(market[3]);
    const now = (await provider.getBlock("latest")).timestamp;
    if (now < deadline) {
        console.warn(
            `Warning: deadline (${deadline}) is in the future relative to current block timestamp (${now}).`
        );
    }

    const observed = await fetchPlaybackCount({ trackId, isrc: trackIsrc });
    if (observed < 0n) {
        throw new Error(
            `Playback count must be non-negative, got ${observed.toString()}.`
        );
    }

    console.log(
        `Calling resolveMarket(${marketId}, ${observed.toString()}) as ${
            oracle.address
        }`
    );
    const tx = await vybe.connect(oracle).resolveMarket(marketId, observed);
    const receipt = await tx.wait();
    console.log(`Resolve tx: ${receipt.hash} (block ${receipt.blockNumber})`);

    const event = receipt.logs
        .map((log) => {
            try {
                return vybe.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .find((parsed) => parsed && parsed.name === "Resolved");
    if (event) {
        console.log(
            `Resolved event → outcomeYes=${
                event.args.outcomeYes
            } yesPool=${event.args.yesPool.toString()} noPool=${event.args.noPool.toString()}`
        );
    }

    const finalState = await vybe.getMarket(marketId);
    console.log(
        `Final state: resolved=${finalState[4]} outcomeYes=${
            finalState[5]
        } yesPool=${finalState[6].toString()} noPool=${finalState[7].toString()}`
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

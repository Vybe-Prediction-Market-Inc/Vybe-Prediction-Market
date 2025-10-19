import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const RAPIDAPI_HOST =
    process.env.RAPIDAPI_HOST ||
    "spotify-track-streams-playback-count1.p.rapidapi.com";

async function fetchPlaybackCount(trackId) {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
        throw new Error("Missing RAPIDAPI_KEY");
    }

    const url = `https://${RAPIDAPI_HOST}/tracks/spotify_track_streams`;
    const { data } = await axios.get(url, {
        params: { spotify_track_id: trackId },
        headers: {
            "x-rapidapi-host": RAPIDAPI_HOST,
            "x-rapidapi-key": apiKey,
        },
    });

    const playbackCount = Number(data?.streams);
    if (!Number.isFinite(playbackCount)) {
        throw new Error(
            `RapidAPI response did not include numeric streams: ${JSON.stringify(
                data
            ).slice(0, 200)}`
        );
    }

    return playbackCount;
}

async function main() {
    const trackId = process.env.TRACK_ID || "4uLU6hMCjMI75M1A2tKUQC";
    const playbackCount = await fetchPlaybackCount(trackId);
    console.log(
        `RapidAPI playback count for track ${trackId}: ${playbackCount}`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

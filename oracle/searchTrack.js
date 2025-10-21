import dotenv from "dotenv";
import axios from "axios";
import {
    fetchClientCredentialsToken,
    getSpotifyToken,
} from "./lib/spotifyAuth.js";

dotenv.config();

function resolveInputs() {
    const [, , songArg, artistArg] = process.argv;

    if (songArg && artistArg) {
        return { songName: songArg, artistName: artistArg };
    }

    const songName = process.env.SONG_NAME;
    const artistName = process.env.ARTIST_NAME;

    if (songName && artistName) {
        return { songName, artistName };
    }

    throw new Error(
        "Provide SONG_NAME and ARTIST_NAME env vars or pass them as arguments."
    );
}

async function queryTrack(token, songName, artistName) {
    const query = `track:${songName} artist:${artistName}`;
    const response = await axios.get("https://api.spotify.com/v1/search", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
            q: query,
            type: "track",
            limit: 1,
        },
    });

    const [firstTrack] = response.data?.tracks?.items || [];
    if (!firstTrack) {
        throw new Error("No matching track found.");
    }

    return firstTrack.id;
}

async function searchTrack(songName, artistName) {
    let token = await getSpotifyToken();
    const hadAccessToken = !!process.env.SPOTIFY_ACCESS_TOKEN;
    const hasClientCreds = !!(
        process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
    );

    try {
        return await queryTrack(token, songName, artistName);
    } catch (err) {
        const status = err?.response?.status;
        if (status === 401 && hasClientCreds && hadAccessToken) {
            token = await fetchClientCredentialsToken(
                process.env.SPOTIFY_CLIENT_ID,
                process.env.SPOTIFY_CLIENT_SECRET
            );
            return await queryTrack(token, songName, artistName);
        }
        throw err;
    }
}

async function main() {
    const { songName, artistName } = resolveInputs();
    const trackId = await searchTrack(songName, artistName);
    console.log(JSON.stringify({ track_id: trackId }, null, 2));
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});

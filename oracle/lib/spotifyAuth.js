import axios from "axios";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export async function fetchClientCredentialsToken(clientId, clientSecret) {
    if (!clientId || !clientSecret) {
        throw new Error("Missing Spotify client credentials");
    }

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
    });

    const response = await axios.post(SPOTIFY_TOKEN_URL, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    console.log("Fetched new Spotify access token");
    console.log(response.data);

    return response.data.access_token;
}

export async function getSpotifyToken(env = process.env) {
    if (env.SPOTIFY_ACCESS_TOKEN) {
        return env.SPOTIFY_ACCESS_TOKEN;
    }

    const clientId = env.SPOTIFY_CLIENT_ID;
    const clientSecret = env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            "Missing SPOTIFY_ACCESS_TOKEN or SPOTIFY_CLIENT_ID/SECRET"
        );
    }

    return fetchClientCredentialsToken(clientId, clientSecret);
}

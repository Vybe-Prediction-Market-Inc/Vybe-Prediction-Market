const hre = require("hardhat");
const path = require("path");
const dotenv = require("dotenv");

// Load env from project root, then local as a secondary (won't override)
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config();

async function getSpotifyToken() {
    if (process.env.SPOTIFY_ACCESS_TOKEN)
        return process.env.SPOTIFY_ACCESS_TOKEN;
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) {
        throw new Error("Set SPOTIFY_ACCESS_TOKEN or SPOTIFY_CLIENT_ID/SECRET");
    }
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", id);
    params.append("client_secret", secret);
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Spotify token error: ${res.status} ${text}`);
    }
    const json = await res.json();
    return json.access_token;
}

async function fetchPopularity(trackId) {
    const tryFetch = async (token) =>
        fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

    let token = await getSpotifyToken();
    let res = await tryFetch(token);
    if (
        res.status === 401 &&
        process.env.SPOTIFY_CLIENT_ID &&
        process.env.SPOTIFY_CLIENT_SECRET &&
        process.env.SPOTIFY_ACCESS_TOKEN
    ) {
        // Fallback: refresh via client credentials when provided access token is invalid
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", process.env.SPOTIFY_CLIENT_ID);
        params.append("client_secret", process.env.SPOTIFY_CLIENT_SECRET);
        const tokRes = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });
        if (!tokRes.ok) {
            const text = await tokRes.text();
            throw new Error(`Spotify token error: ${tokRes.status} ${text}`);
        }
        const tokJson = await tokRes.json();
        token = tokJson.access_token;
        res = await tryFetch(token);
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Spotify track error: ${res.status} ${text}`);
    }
    const json = await res.json();
    return json.popularity;
}

async function main() {
    const [deployer, oracle, alice, bob] = await hre.ethers.getSigners();

    // Deploy contract
    const Vybe = await hre.ethers.getContractFactory("VybePredictionMarket");
    const vybe = await Vybe.deploy(oracle.address);
    await vybe.waitForDeployment();
    const addr = await vybe.getAddress();
    console.log("VybePredictionMarket:", addr);

    // Params
    const trackId = process.env.TRACK_ID || "4ubwzNjqHGaZZ5k06PDx1H";
    const threshold = Number(process.env.THRESHOLD || 80);

    // Create a market with 5s deadline
    const latest = await hre.ethers.provider.getBlock("latest");
    const deadline = latest.timestamp + 5;
    await (
        await vybe.createMarket(
            `Will this track hit popularity >= ${threshold}?`,
            trackId,
            threshold,
            deadline
        )
    ).wait();
    const marketId = await vybe.marketCount();
    console.log("Market created:", marketId.toString(), "deadline:", deadline);

    // Place some bets
    await (
        await vybe
            .connect(alice)
            .buyYes(marketId, { value: hre.ethers.parseEther("0.1") })
    ).wait();
    await (
        await vybe
            .connect(bob)
            .buyNo(marketId, { value: hre.ethers.parseEther("0.2") })
    ).wait();
    console.log("Bets placed: Alice YES 0.1, Bob NO 0.2");

    // Fast-forward after deadline
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [deadline + 1]);
    await hre.ethers.provider.send("evm_mine", []);

    // Fetch Spotify popularity and resolve via oracle signer
    const popularity = await fetchPopularity(trackId);
    console.log(`Spotify popularity for ${trackId}:`, popularity);
    await (
        await vybe.connect(oracle).resolveMarket(marketId, popularity)
    ).wait();
    console.log("Resolved using Spotify data.");

    // Redeem for winning side
    const outcomeYes = popularity >= threshold;
    if (outcomeYes) {
        const before = await hre.ethers.provider.getBalance(alice.address);
        const rcpt = await (await vybe.connect(alice).redeem(marketId)).wait();
        const after = await hre.ethers.provider.getBalance(alice.address);
        console.log(
            "Alice redeemed ->",
            rcpt.hash,
            "delta:",
            (after - before).toString(),
            "wei"
        );
    } else {
        const before = await hre.ethers.provider.getBalance(bob.address);
        const rcpt = await (await vybe.connect(bob).redeem(marketId)).wait();
        const after = await hre.ethers.provider.getBalance(bob.address);
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

import 'dotenv/config'
import axios from 'axios'
import { ethers } from 'ethers'

async function fetchSpotifyStreams(trackId) {
  const token = process.env.SPOTIFY_TOKEN // for hackathon, you can generate manually
  const res = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const streams = res.data.popularity // Simplified proxy for hackathon
  console.log(`Track ${trackId} has ${streams} popularity`)
  return streams
}

async function postToOracleContract(marketAddress, value) {
  // connect to wallet + contract
  // call resolveMarket(marketAddress, value)
}

fetchSpotifyStreams('4uLU6hMCjMI75M1A2tKUQC')

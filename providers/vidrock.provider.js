const crypto = require('crypto');
const axios = require("axios");

const KEY = "x7k9mPqT2rWvY8zA5bC3nF6hJ2lK4mN9";
const IV = KEY.substring(0, 16);
const API_BASE = "https://vidrock.net/api";

/**
 * Encrypts TMDB ID (or TV ID format) using AES-256-CBC
 */
function encodeTmdbId(id, type, season, episode) {
    const rawData = type === "tv" || type === "series" ? `${id}_${season}_${episode}` : id;
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(KEY), Buffer.from(IV));
    let encrypted = cipher.update(rawData, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return encrypted
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function getVidRockRawResponse(tmdbId, type, season = "", episode = "") {
    const encryptedId = encodeTmdbId(tmdbId, type, season, episode);
    const endpoint = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
    const url = `${API_BASE}/${endpoint}/${encodeURIComponent(encryptedId)}`;

    console.log(`[VidRock] Fetching: ${url}`);
    try {
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://vidrock.net/',
                'Origin': 'https://vidrock.net/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            timeout: 300000
        });
        return response.data;
    } catch (error) {
        return { error: error.message, status: error.response?.status };
    }
}

async function getVidRockStreams(tmdbId, type, season = "", episode = "") {
    const data = await getVidRockRawResponse(tmdbId, type, season, episode);
    if (!data || typeof data !== 'object' || data.error) return [];

    const streams = [];
    for (const [serverName, source] of Object.entries(data)) {
        if (source && typeof source === 'object' && source.url) {
            streams.push({
                server: serverName,
                url: source.url,
                type: source.url.includes('.m3u8') ? 'm3u8' : 'mp4',
                quality: 'Auto',
                language: source.language || "Original",
                headers: {
                    'Referer': 'https://vidrock.net/',
                    'Origin': 'https://vidrock.net'
                },
                provider: "VidRock"
            });
        }
    }
    return streams;
}

module.exports = { getVidRockStreams, getVidRockRawResponse };
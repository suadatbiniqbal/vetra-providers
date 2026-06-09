const crypto = require('crypto');
const axios = require("axios");

/**
 * CinemaOS logic extracted from test.js
 */

// V2 Security Constants (Updated April 2026)
const V2_HASH_SECRET = "dde0443a51aed264819df2c1292e678eacf0bbaff0ed279cce0b0f2094fcabe5";
const V2_RK_VALUE = "2549b22d9bf0d91847a2811baac98d0079e02dba592aea94";

// V3 Keys
const HMAC_KEY_1 = "a7f3b9c2e8d4f1a6b5c9e2d7f4a8b3c6e1d9f7a4b2c8e5d3f9a6b4c1e7d2f8a5";
const HMAC_KEY_2 = "d3f8a5b2c9e6d1f7a4b8c5e2d9f3a6b1c7e4d8f2a9b5c3e7d4f1a8b6c2e9d5f3";
const ENCRYPTION_KEY = "a1b2c3d4e4f6477658455678901477567890abcdef1234567890abcdef123456";

/**
 * 1. V2 HASH GENERATOR ("h" parameter)
 * Replicates the client-side bitwise hashing for V2 validation.
 */
function generateV2Hash(tmdbId) {
    const timeInMinutes = Math.floor(Date.now() / 60000);
    const input = `${tmdbId}:${timeInMinutes}:${V2_HASH_SECRET}`;

    let hashInt = 0;
    for (let i = 0; i < input.length; i++) {
        hashInt = (hashInt << 5) - hashInt + input.charCodeAt(i);
        hashInt &= hashInt; // Force 32-bit signed integer
    }

    const hashHex = Math.abs(hashInt).toString(16).padStart(8, "0");
    return `${hashHex}-${timeInMinutes.toString(36)}`;
}

/**
 * 2. SIGNATURE GENERATOR (HMAC SHA256)
 */
function getSignature(tmdbId, imdbId, season, episode) {
    let parts = [];
    if (tmdbId) parts.push(`tmdbId:${tmdbId}`);
    if (imdbId) parts.push(`imdbId:${imdbId}`);
    if (season !== undefined && season !== null && season !== "") parts.push(`seasonId:${season}`);
    if (episode !== undefined && episode !== null && episode !== "") parts.push(`episodeId:${episode}`);

    const input = parts.join("|");
    const hmac1 = crypto.createHmac('sha256', HMAC_KEY_1).update(input).digest('hex');
    return crypto.createHmac('sha256', HMAC_KEY_2).update(hmac1).digest('hex');
}

/**
 * 3. AES-256-GCM DECRYPTOR (PBKDF2 + GCM)
 */
function decryptPayload(data) {
    const { encrypted, cin, mao, salt, version } = data;

    const iv = Buffer.from(cin, 'hex');      // IV
    const tag = Buffer.from(mao, 'hex');     // Auth Tag
    const ciphertext = Buffer.from(encrypted, 'hex');

    let saltBuf;
    if (salt) {
        saltBuf = Buffer.from(salt, 'hex');
    } else {
        saltBuf = crypto.createHash('sha256').update(iv).digest().slice(0, 32);
    }

    let key;
    if (version !== undefined && !(version >= 1)) {
        key = Buffer.from(ENCRYPTION_KEY, 'hex');
    } else {
        key = crypto.pbkdf2Sync(
            ENCRYPTION_KEY,
            saltBuf,
            100000,
            32,
            'sha256'
        );
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decryptedBuf = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]);
    const decrypted = decryptedBuf.toString('utf8');

    return JSON.parse(decrypted);
}


/**
 * 5. FETCH TMDB METADATA (Improved for TV Episodes)
 */
async function fetchTmdbMetadata(tmdbId, type, season = "", episode = "") {
    const isTV = type === "series" || type === "tv";
    const mediaType = isTV ? "tv" : "movie";

    let apiUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?append_to_response=external_ids&api_key=20bea604243a8f99322f925df8f3feab`;

    // If it's a TV show and we have season/episode, fetch episode-specific data too
    if (isTV && season && episode) {
        apiUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?append_to_response=external_ids&api_key=20bea604243a8f99322f925df8f3feab`;
    }

    try {
        const response = await axios.get(apiUrl, {
            headers: { "accept": "application/json" },
            timeout: 10000
        });

        let data = response.data;

        // If we fetched episode data, we might still need some show-level info like original show name
        if (isTV && season && episode) {
            try {
                const showUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=20bea604243a8f99322f925df8f3feab`;
                const showRes = await axios.get(showUrl, {
                    timeout: 5000
                });
                data.show_name = showRes.data.name || showRes.data.original_name;
            } catch (e) {
                console.warn("[CinemaOS] Could not fetch show-level name for episode");
            }
        }

        return data;
    } catch (error) {
        throw new Error(`Failed to fetch TMDB metadata: ${error.message}`);
    }
}

/**
 * 6. RESPONSE TRANSFORMER (Cleaned up and flattened)
 */
function transformResponse(data) {
    return data;
}

/**
 * 7. MAIN STREAM FETCH FUNCTION
 */
async function getCinemaOSStream(tmdbId, type, season = "", episode = "") {
    try {
        // Step A: Fetch TMDB Metadata for title and year
        const tmdbData = await fetchTmdbMetadata(tmdbId, type, season, episode);
        const imdbId = tmdbData.external_ids?.imdb_id || "";

        // Step B: Generate signature
        const secret = getSignature(tmdbId, imdbId, season, episode);

        const apiUrl = `https://cinemaos.live/api/providerv4`;
        const cinemaType = (type === "series" || type === "tv") ? "tv" : "movie";
        const params = {
            type: cinemaType,
            tmdbId,
            imdbId,
            secret,
            _gt: "2549b22d9bf0d91847a2811baac98d0079e02dba592aea94"
        };

        if (season) params.seasonId = season;
        if (episode) params.episodeId = episode;

        // Step C: Call CinemaOS API
        const response = await axios.get(apiUrl, {
            params,
            headers: {
                'Referer': 'https://cinemaos.live/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.data.encrypted && response.data.data) {
            // Step D: Decrypt and Transform
            const decryptedJson = decryptPayload(response.data.data);
            const transformed = transformResponse(decryptedJson);

            // Step E: Standardize output (Flatten streams)
            const flattenedStreams = [];
            if (transformed.sources) {
                Object.keys(transformed.sources).forEach(key => {
                    const source = transformed.sources[key];
                    if (source.qualities) {
                        Object.keys(source.qualities).forEach(q => {
                            const rawUrl = source.qualities[q].url;
                            flattenedStreams.push({
                                server: `${source.server || key} (${q}p)`,
                                url: rawUrl,
                                type: source.qualities[q].type || "mp4",
                                quality: q,
                                headers: source.qualities[q].headers || source.headers,
                                provider: "CinemaOS"
                            });
                        });
                    } else {
                        const rawUrl = source.url;
                        flattenedStreams.push({
                            server: source.server || key,
                            url: rawUrl,
                            type: source.type || "m3u8",
                            quality: source.bitrate || "Auto",
                            headers: source.headers,
                            provider: "CinemaOS"
                        });
                    }
                });
            }

            return {
                success: true,
                tmdb: tmdbData,
                streams: flattenedStreams,
                skipTime: transformed.skipTime || null,
                cached: response.data.cached || false
            };
        } else {
            return {
                error: "Server returned unencrypted or invalid data",
                raw: response.data
            };
        }

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 8. LANGUAGE PARSER
 * Extracts language from metadata string, e.g., "(Hindi)" or "(Original Audio)".
 */
function extractLanguage(metadata) {
    if (!metadata) return null;

    // Pattern: Find text inside the first set of parentheses
    const match = metadata.match(/\(([^)]+)\)/);
    if (!match) return null;

    let raw = match[1].trim().toLowerCase();
    let type = "dubbed"; // Default to dubbed

    // Determine type based on keywords
    if (raw.includes("sub") || raw.includes("subtitle")) {
        type = "subtitle";
    }

    // Clean up language name by removing common suffixes/keywords
    let lang = raw
        .replace(/\bsub(s|title)?\b/g, "")
        .replace(/\bdub(s|bed)?\b/g, "")
        .replace(/\baudio\b/g, "")
        .replace(/\boriginal\b/g, "English") // Map "Original Audio" to "English"
        .trim();

    // Capitalize first letter of each word
    lang = lang.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    if (!lang) lang = "English";

    return `${lang}:${type}`;
}

/**
 * 9. MOVIEBOX SCRAPER (Updated with V2 hash)
 */
async function getMovieBoxStream(tmdbId, type, season = "", episode = "") {
    try {
        const cinemaType = (type === "series" || type === "tv") ? "tv" : "movie";
        const hToken = generateV2Hash(tmdbId);

        const params = {
            tmdbId: tmdbId,
            type: cinemaType,
            h: hToken,
            _gt: V2_RK_VALUE
        };
        if (cinemaType === "tv") {
            params.season = String(season);
            params.episode = String(episode);
        }

        const response = await axios.get(`https://cinemaos.live/api/cinemaosv2`, {
            params,
            headers: {
                'Referer': 'https://cinemaos.live/',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        if (response.data?.streams) {
            return {
                success: true,
                provider: "CinemaOS-V2",
                streams: response.data.streams.map(s => {
                    const metadata = s.name || `Server ${s.quality}`;
                    return {
                        server: metadata,
                        url: s.url,
                        quality: s.quality || "HD",
                        headers: s.headers || {},
                        isHls: s.url.includes('.m3u8'),
                        provider: "MovieBox",
                        language: extractLanguage(metadata)
                    };
                }),
                captions: response.data.captions || []
            };
        }
        return { success: false, error: "V2 endpoint returned no data." };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 9. FUCKIT SCRAPER
 * Fires all 17 servers in parallel (skipping sr=3), resolves with the first
 * server that returns a valid stream. Falls back to failure if all servers fail.
 */
async function getFuckItStream(tmdbId, imdbId, title, year, type, season = "", episode = "") {
    const isTV = type === "series" || type === "tv";
    const mediaType = isTV ? "tv" : "movie";
    const apiUrl = `https://cinemaos.live/api/fuckit/scraper`;

    let formattedTitle = title;
    if (isTV && season && episode) {
        formattedTitle = `${title} S${season}:E${episode}`;
    }

    const baseParams = {
        title: formattedTitle,
        mediaType,
        year,
        tmdbId,
        imdbId,
        ...(isTV && season && episode ? { seasonId: season, episodeId: episode } : {})
    };

    const SERVER_COUNT = 17;
    const SKIP_SERVERS = new Set([3]);

    const serverNumbers = Array.from(
        { length: SERVER_COUNT },
        (_, i) => i + 1
    ).filter(n => !SKIP_SERVERS.has(n));

    const fetchServer = async (sr) => {
        try {
            const response = await axios.get(apiUrl, {
                params: { ...baseParams, sr },
                headers: {
                    'Referer': 'https://cinemaos.live/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                },
                timeout: 8000
            });

            const data = response.data;
            if (!data?.success || !data?.decryptedData) return null;

            const decrypted = data.decryptedData;
            const streams = [];

            if (Array.isArray(decrypted.quality) && decrypted.quality.length > 0) {
                decrypted.quality.forEach(q => {
                    streams.push({
                        server: `FuckIt-sr${sr} (${q.quality})`,
                        url: q.url,
                        quality: q.quality,
                        headers: { "Referer": "https://videasy.net" },
                        provider: "FuckIt"
                    });
                });
            } else if (decrypted.url) {
                streams.push({
                    server: `FuckIt-sr${sr}`,
                    url: decrypted.url,
                    quality: "Auto",
                    headers: { "Referer": "https://videasy.net" },
                    provider: "FuckIt"
                });
            }

            if (streams.length === 0) return null;
            return { sr, streams };
        } catch {
            return null;
        }
    };

    // Race all servers — resolve on the first non-null result
    return new Promise((resolve) => {
        let settled = false;
        let pending = serverNumbers.length;

        const onResult = (result) => {
            pending--;
            if (result && !settled) {
                settled = true;
                resolve({ success: true, streams: result.streams, sr: result.sr });
            } else if (pending === 0 && !settled) {
                resolve({ success: false, error: "All FuckIt servers failed or returned no streams" });
            }
        };

        serverNumbers.forEach(sr => fetchServer(sr).then(onResult));
    });
}

module.exports = {
    getCinemaOSStream,
    getMovieBoxStream,
    getFuckItStream,
    generateV2Hash
};
const crypto = require('crypto');
const axios = require('axios');

const DECRYPTION_KEY = "vidlux-stream-encryption-2026-secure-key";
const PROVIDERS = [
    'spider', 'rocket', 'star', 'bolt', 'quilox',
    'vidrock', 'dubai', 'magic', 'vixsrc', 'astra'
];

async function decryptPayload(encryptedBase64) {
    try {
        const cipherData = Buffer.from(encryptedBase64, 'base64');
        if (cipherData.length < 28) throw new Error("Payload too short");

        const iv = cipherData.subarray(0, 12);
        const encryptedAndTag = cipherData.subarray(12);
        const tag = encryptedAndTag.subarray(encryptedAndTag.length - 16);
        const ciphertext = encryptedAndTag.subarray(0, encryptedAndTag.length - 16);

        const keyHash = crypto.createHash('sha256').update(DECRYPTION_KEY, 'utf8').digest();
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyHash, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(ciphertext, null, 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (err) {
        console.error("Decrypt error:", err.message);
        throw new Error("Decryption failed: " + err.message);
    }
}

async function fetchProvider(provider, tmdbId, type, season, episode, _t, title, year) {
    try {
        const params = new URLSearchParams({ id: tmdbId, type });
        if (type === 'tv' || type === 'series') {
            params.set('type', 'tv');
            params.append('season', season);
            params.append('episode', episode);
        } else {
            params.set('type', 'movie');
        }
        if (_t) params.append('_t', _t);
        if (provider === 'magic') {
            if (title) params.append('title', title);
            if (year) params.append('year', year);
        }

        const url = `https://vidlux.xyz/api/extract/${provider}?${params.toString()}`;
        console.log(`[Vidlux Provider] [${provider}] Fetching: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://vidlux.xyz/',
                'Origin': 'https://vidlux.xyz'
            },
            timeout: 15000
        });

        const data = response.data;
        let decrypted = data;
        if (data && data.encrypted && data.data) {
            decrypted = await decryptPayload(data.data);
        }

        return { provider, success: true, data: decrypted };
    } catch (error) {
        console.error(`[Vidlux Provider] [${provider}] Error: ${error.message}`);
        return { provider, success: false, error: error.message };
    }
}

async function getVidluxStreams(tmdbId, type, season = "", episode = "", title = "", year = "") {
    try {
        const mediaType = (type === "series" || type === "tv") ? "tv" : "movie";

        // Step 1: Scrape requestToken (_t) from embed URL
        const embedUrl = mediaType === 'tv'
            ? `https://vidlux.xyz/embed/tv/${tmdbId}/${season}/${episode}`
            : `https://vidlux.xyz/embed/movie/${tmdbId}`;

        console.log(`[Vidlux Provider] Scraping token from: ${embedUrl}`);
        const embedResponse = await axios.get(embedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://vidlux.xyz/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 15000
        });

        const html = embedResponse.data;
        const tokenMatch = html.match(/requestToken[\\]*"\s*:\s*[\\]*"([a-f0-9\.]+)/i);
        let _t = null;
        if (tokenMatch) {
            _t = tokenMatch[1];
            console.log(`[Vidlux Provider] Extracted token: ${_t}`);
        } else {
            console.warn(`[Vidlux Provider] Token not found in embed page`);
        }

        // Step 2: Query all providers in parallel
        console.log(`[Vidlux Provider] Querying ${PROVIDERS.length} providers...`);
        const promises = PROVIDERS.map(p =>
            fetchProvider(p, tmdbId, mediaType, season, episode, _t, title, year)
        );

        const results = await Promise.all(promises);
        const streams = [];

        for (const resObj of results) {
            if (resObj.success && resObj.data) {
                const payload = resObj.data;
                const parseStream = (s) => {
                    const fileUrl = s.file || s.url || s.stream_url;
                    if (!fileUrl) return;
                    streams.push({
                        url: fileUrl,
                        server: s.title || resObj.provider,
                        quality: s.quality || 'Auto',
                        type: s.type === 'hls' ? 'm3u8' : (s.type || 'mp4'),
                        headers: {
                            'Referer': 'https://vidlux.xyz/',
                            'Origin': 'https://vidlux.xyz'
                        },
                        provider: "Vidlux"
                    });
                };

                if (payload.streams && Array.isArray(payload.streams)) {
                    payload.streams.forEach(parseStream);
                } else if (Array.isArray(payload)) {
                    payload.forEach(parseStream);
                }
            }
        }

        return {
            success: true,
            streams: streams
        };
    } catch (error) {
        console.error(`[Vidlux Provider] Error:`, error.message);
        return { success: false, error: error.message };
    }
}

async function getVidluxRawResponse(tmdbId, type, season = "", episode = "", title = "", year = "") {
    return await getVidluxStreams(tmdbId, type, season, episode, title, year);
}

module.exports = {
    getVidluxStreams,
    getVidluxRawResponse
};
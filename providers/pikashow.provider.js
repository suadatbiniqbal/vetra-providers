const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_KEY = "picashow-api-secret-key";
const HMAC_SECRET = "picashow-api-secret-2025";
const MAIN_URL = "https://manoda.co";
const TMDB_KEY = "20bea604243a8f99322f925df8f3feab";

const gaid = uuidv4();
const deviceUuid = uuidv4();

function getHeaders() {
    const timestampSeconds = Math.floor(Date.now() / 1000).toString();
    const message = `${API_KEY}:${timestampSeconds}`;
    const hmac = crypto.createHmac('sha256', HMAC_SECRET);
    hmac.update(message);
    const signatureHex = hmac.digest('hex');

    return {
        'Host': 'manoda.co',
        'user-agent': `Pikashow/2509030 (Android 13; Pixel 5; Channel/pikashow; gaid/${gaid}); Uuid/${deviceUuid}`,
        'X-API-Key': API_KEY,
        'X-Signature': signatureHex,
        'X-Timestamp': timestampSeconds,
        'Accept-Encoding': 'gzip'
    };
}

async function fetchFromPikashow(endpoint, params = {}) {
    const url = new URL(`${MAIN_URL}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const targetUrl = url.toString();
    const headers = getHeaders();

    try {
        const response = await axios.get(targetUrl, { headers, timeout: 15000 });
        return response.data;
    } catch (error) {
        console.error(`[Pikashow Provider] Fetch failed: ${error.message}`);
        throw error;
    }
}

async function getPikashowStreams(tmdbId, type, season = "", episode = "") {
    // Only movies are supported on Pikashow via this name/image matching logic
    if (type !== "movie" && type !== "movies") {
        return { success: false, error: "Only movies supported by Pikashow provider" };
    }

    try {
        // Step 1: Fetch TMDB Metadata for movie to get title and images
        const tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=videos,credits,images,recommendations`;
        console.log(`[Pikashow Provider] Fetching TMDB metadata for ID: ${tmdbId}`);
        const tmdbRes = await axios.get(tmdbUrl, { timeout: 10000 });
        const tmdbData = tmdbRes.data;
        const title = tmdbData.title || tmdbData.original_title;

        if (!title) {
            return { success: false, error: "TMDB title not found" };
        }

        // Collect all images from TMDB response
        const tmdbImagePaths = new Set();
        if (tmdbData.poster_path) tmdbImagePaths.add(tmdbData.poster_path.replace(/^\//, ''));
        if (tmdbData.backdrop_path) tmdbImagePaths.add(tmdbData.backdrop_path.replace(/^\//, ''));

        if (tmdbData.images?.posters) {
            tmdbData.images.posters.forEach(img => {
                if (img.file_path) tmdbImagePaths.add(img.file_path.replace(/^\//, ''));
            });
        }
        if (tmdbData.images?.backdrops) {
            tmdbData.images.backdrops.forEach(img => {
                if (img.file_path) tmdbImagePaths.add(img.file_path.replace(/^\//, ''));
            });
        }

        console.log(`[Pikashow Provider] Searching for movie title: "${title}"`);
        const searchTypes = ['hollywood', 'bollywood'];
        const results = [];

        const promises = searchTypes.map(stype =>
            fetchFromPikashow('/v1/api/videos', { type: stype, channel: 'pikashow' })
                .then(data => {
                    const records = data.records || data.series || [];
                    records.forEach(item => {
                        const itemTitle = item.t || item.title || '';
                        const itemGenre = item.g || item.genre || '';

                        if (itemTitle.toLowerCase().includes(title.toLowerCase()) ||
                            itemGenre.toLowerCase().includes(title.toLowerCase())) {
                            results.push({
                                id: item.so || item.sortOrder || item.id,
                                title: itemTitle,
                                genre: itemGenre,
                                year: item.y || item.year,
                                quality: item.q || item.quality || 'HD',
                                cover: item.c || item.cover,
                                type: stype,
                                raw: item
                            });
                        }
                    });
                })
                .catch(err => {
                    console.error(`[Pikashow Provider] Error fetching category ${stype}:`, err.message);
                })
        );

        await Promise.all(promises);

        // Find the matched item by comparing cover image filenames
        const matchedItem = results.find(item => {
            if (!item.cover) return false;
            const filename = item.cover.split('/').pop();
            return tmdbImagePaths.has(filename);
        });

        if (!matchedItem) {
            console.log(`[Pikashow Provider] No image matches for "${title}"`);
            return { success: false, error: "No image matches found" };
        }

        console.log(`[Pikashow Provider] Match found: ${matchedItem.title} (ID: ${matchedItem.id})`);

        const item = matchedItem.raw;
        const streams = [];

        const clientUrls = item.clientUrls || [];
        if (clientUrls.length > 0) {
            clientUrls.forEach(cu => {
                if (cu.url) {
                    const isHls = cu.url.includes('.m3u8');
                    streams.push({
                        url: cu.url,
                        server: cu.label || 'Server 1',
                        quality: item.q || item.quality || "HD",
                        type: isHls ? "m3u8" : "mp4",
                        isHls: isHls,
                        headers: {},
                        provider: "Pikashow"
                    });
                }
            });
        } else if (item.url || item.videoUrl || item.playUrl) {
            const streamUrl = item.url || item.videoUrl || item.playUrl;
            const isHls = streamUrl.includes('.m3u8');
            streams.push({
                url: streamUrl,
                server: "Server 1",
                quality: item.q || item.quality || "HD",
                type: isHls ? "m3u8" : "mp4",
                isHls: isHls,
                headers: {},
                provider: "Pikashow"
            });
        }

        return {
            success: true,
            streams: streams
        };

    } catch (error) {
        console.error(`[Pikashow Provider] Error getting streams:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    getPikashowStreams
};
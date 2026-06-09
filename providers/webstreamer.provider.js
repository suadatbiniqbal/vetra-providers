const axios = require("axios");

async function getWebstreamerRawResponse(imdbId, type, season = "", episode = "") {
    if (!imdbId || imdbId === "undefined") return { error: "Missing IMDB ID" };

    // Webstreamer uses 'movie' and 'series'
    const normalizedType = (type === "series" || type === "tv") ? "series" : "movie";
    const isSeries = normalizedType === "series";

    const url = `https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/{"multi":"on","al":"on","de":"on","es":"on","fr":"on","hi":"on","it":"on","mx":"on","mediaFlowProxyUrl":"","mediaFlowProxyPassword":""}/stream/${normalizedType}/${imdbId}${isSeries ? `:${season}:${episode}` : ""
        }.json`;

    console.log(`[Webstreamer] Fetching: ${url}`);
    try {
        const res = await axios.get(encodeURI(url), {
            timeout: 30000,
        });
        return res.data;
    } catch (e) {
        return { error: e.message };
    }
}

/**
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

async function getWebstreamerStreams(imdbId, type, season = "", episode = "") {
    const data = await getWebstreamerRawResponse(imdbId, type, season, episode);
    if (!data?.streams) return [];

    return data.streams.map((source) => {
        const name = source?.name || "WebStreamer";
        const qualityMatch = name?.match(/(\d{3,4})p/);
        const quality = qualityMatch ? qualityMatch[1] : "Auto";

        return {
            server: name,
            url: source?.url,
            type: (source?.url?.includes(".m3u8") || source?.url?.includes(".m3u")) ? "m3u8" : "mp4",
            quality: quality,
            language: extractLanguage(name)
        };
    });
}

module.exports = { getWebstreamerStreams, getWebstreamerRawResponse };
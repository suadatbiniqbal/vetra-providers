const altchaSolver = require('./altcha-solver.utility.js');
const axios = require('axios');

const BASE_URL = "https://mznxiwqjdiq00239q.space";

/**
 * Challenge Provider (formerly ScreenScape)
 * Fetches streams from the /finger endpoint after solving an Altcha challenge.
 */
async function getChallengeStreams(tmdbId, imdbId, title, year, type, season = "", episode = "") {
    const mediaType = (type === "series" || type === "tv") ? "tv" : "movie";

    try {
        // Step 1: Get Altcha challenge and solve it
        // The endpoint is /altcha/challenge as verified
        console.log(`[ChallengeProvider] Fetching Altcha challenge...`);
        const altchaPayload = await altchaSolver.getPayload(`${BASE_URL}/altcha/challenge`);

        if (!altchaPayload) {
            console.error(`[ChallengeProvider] Failed to get Altcha payload.`);
            return { success: false, error: "Altcha challenge failed" };
        }

        // Step 2: Make request to finger endpoint
        // Using parameters exactly as seen in the user's example
        console.log(`[ChallengeProvider] Requesting streams from /finger...`);
        
        const params = {
            name: title,
            year: year,
            id: tmdbId,
            imdb: imdbId,
            altcha: altchaPayload
        };

        if (mediaType === "tv") {
            params.season = season;
            params.episode = episode;
        }

        const response = await axios.get(`${BASE_URL}/finger`, {
            params: params,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://mznxiwqjdiq00239q.space/',
                'Origin': 'https://mznxiwqjdiq00239q.space'
            }
        });

        if (response.data && response.data.success) {
            console.log(`[ChallengeProvider] Successfully fetched streams.`);
            // Assuming the response.data.data contains the stream info
            const stream = response.data.data;
            if (stream && stream.url) {
                return {
                    success: true,
                    data: [
                        {
                            name: "Challenge Server",
                            quality: stream.quality || "HD",
                            url: stream.url,
                            headers: {
                                "Referer": BASE_URL,
                                "Origin": BASE_URL
                            }
                        }
                    ]
                };
            }
        }

        console.warn(`[ChallengeProvider] No streams found or request failed.`);
        return { success: false, error: "No streams found" };

    } catch (error) {
        console.error(`[ChallengeProvider] Error:`, error.message);
        return { success: false, error: error.message };
    }
}

async function getChallengeRawResponse(tmdbId, imdbId, title, year, type, season = "", episode = "") {
    return await getChallengeStreams(tmdbId, imdbId, title, year, type, season, episode);
}

module.exports = { getChallengeStreams, getChallengeRawResponse };
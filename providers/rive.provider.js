const axios = require('axios');

const c = [
    "4Z7lUo", "gwIVSMD", "PLmz2elE2v", "Z4OFV0", "SZ6RZq6Zc", "zhJEFYxrz8", "FOm7b0",
    "axHS3q4KDq", "o9zuXQ", "4Aebt", "wgjjWwKKx", "rY4VIxqSN", "kfjbnSo", "2DyrFA1M",
    "YUixDM9B", "JQvgEj0", "mcuFx6JIek", "eoTKe26gL", "qaI9EVO1rB", "0xl33btZL",
    "1fszuAU", "a7jnHzst6P", "wQuJkX", "cBNhTJlEOf", "KNcFWhDvgT", "XipDGjST",
    "PCZJlbHoyt", "2AYnMZkqd", "HIpJh", "KH0C3iztrG", "W81hjts92", "rJhAT",
    "NON7LKoMQ", "NMdY3nsKzI", "t4En5v", "Qq5cOQ9H", "Y9nwrp", "VX5FYVfsf",
    "cE5SJG", "x1vj1", "HegbLe", "zJ3nmt4OA", "gt7rxW57dq", "clIE9b", "jyJ9g",
    "B5jXjMCSx", "cOzZBZTV", "FTXGy", "Dfh1q1", "ny9jqZ2POI", "X2NnMn", "MBtoyD",
    "qz4Ilys7wB", "68lbOMye", "3YUJnmxp", "1fv5Imona", "PlfvvXD7mA", "ZarKfHCaPR",
    "owORnX", "dQP1YU", "dVdkx", "qgiK0E", "cx9wQ", "5F9bGa", "7UjkKrp", "Yvhrj",
    "wYXez5Dg3", "pG4GMU", "MwMAu", "rFRD5wlM",
];

function generateSecretKey(id) {
    if (id === undefined) return "rive";

    try {
        let t, n;
        const r = String(id);

        if (isNaN(Number(id))) {
            const sum = r.split("").reduce((e, ch) => e + ch.charCodeAt(0), 0);
            t = c[sum % c.length] || btoa(r);
            n = Math.floor((sum % r.length) / 2);
        } else {
            const num = Number(id);
            t = c[num % c.length] || btoa(r);
            n = Math.floor((num % r.length) / 2);
        }

        const i = r.slice(0, n) + t + r.slice(n);

        const innerHash = (e) => {
            e = String(e);
            let t = 0 >>> 0;
            for (let n = 0; n < e.length; n++) {
                const r = e.charCodeAt(n);
                const i =
                    (((t = (r + (t << 6) + (t << 16) - t) >>> 0) << n % 5) |
                        (t >>> (32 - (n % 5)))) >>>
                    0;
                t = (t ^ (i ^ (((r << n % 7) | (r >>> (8 - (n % 7)))) >>> 0))) >>> 0;
                t = (t + ((t >>> 11) ^ (t << 3))) >>> 0;
            }
            t ^= t >>> 15;
            t = ((t & 65535) * 49842 + ((((t >>> 16) * 49842) & 65535) << 16)) >>> 0;
            t ^= t >>> 13;
            t = ((t & 65535) * 40503 + ((((t >>> 16) * 40503) & 65535) << 16)) >>> 0;
            t ^= t >>> 16;
            return t.toString(16).padStart(8, "0");
        };

        const outerHash = (e) => {
            const t = String(e);
            let n = (3735928559 ^ t.length) >>> 0;
            for (let idx = 0; idx < t.length; idx++) {
                let r = t.charCodeAt(idx);
                r ^= ((131 * idx + 89) ^ (r << idx % 5)) & 255;
                n = (((n << 7) | (n >>> 25)) >>> 0) ^ r;
                const i = ((n & 65535) * 60205) >>> 0;
                const o = (((n >>> 16) * 60205) << 16) >>> 0;
                n = (i + o) >>> 0;
                n ^= n >>> 11;
            }
            n ^= n >>> 15;
            n = (((n & 65535) * 49842 + (((n >>> 16) * 49842) << 16)) >>> 0) >>> 0;
            n ^= n >>> 13;
            n = (((n & 65535) * 40503 + (((n >>> 16) * 40503) << 16)) >>> 0) >>> 0;
            n ^= n >>> 16;
            n = (((n & 65535) * 10196 + (((n >>> 16) * 10196) << 16)) >>> 0) >>> 0;
            n ^= n >>> 15;
            return n.toString(16).padStart(8, "0");
        };

        const o = outerHash(innerHash(i));
        return btoa(o);
    } catch (e) {
        return "topSecret";
    }
}

async function getRiveRawResponse(tmdbId, type, server, season = "", episode = "") {
    const secret = generateSecretKey(tmdbId);
    const baseUrl = "https://www.rivestream.app";
    const route = type === "series" || type === "tv"
        ? `/api/backendfetch?requestID=tvVideoProvider&id=${tmdbId}&season=${season}&episode=${episode}&secretKey=${secret}&proxyMode=noProxy&service=`
        : `/api/backendfetch?requestID=movieVideoProvider&id=${tmdbId}&secretKey=${secret}&proxyMode=noProxy&service=`;

    console.log(`[Rive] Fetching: ${baseUrl + route + server}`);
    try {
        const res = await axios.get(baseUrl + route + server, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
                "Referer": "https://www.rivestream.app/",
            },
            timeout: 10000
        });
        return res.data;
    } catch (e) {
        return { error: e.message, status: e.response?.status, data: e.response?.data };
    }
}

function processRiveResponse(data) {
    return data;
}

async function getRiveStreams(tmdbId, type, season = "", episode = "") {
    const servers = ["flowcast", "asiacloud", "hindicast", "guru"];
    const streams = [];
    await Promise.all(servers.map(async (server) => {
        let data = await getRiveRawResponse(tmdbId, type, server, season, episode);

        if (data?.data?.sources) {
            data.data.sources.forEach(source => {
                let url = source?.url || "";
                let headers = { referer: "https://www.rivestream.app" };
                
                // No proxy parsing necessary

                const streamObj = {
                    server: source?.source + "-" + source?.quality,
                    url: url,
                    type: source?.format === "hls" ? "m3u8" : "mp4",
                    quality: source?.quality,
                    headers: headers
                };

                streams.push(streamObj);
            });
        }
    }));
    return streams;
}

module.exports = { generateSecretKey, getRiveStreams, getRiveRawResponse, processRiveResponse };
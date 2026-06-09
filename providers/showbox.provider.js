const { Session } = require('node-tls-client');

const FEBBOX_COOKIE = 'PHPSESSID=0sfc06aesk3cf3sq76rc66sr19; ui=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3ODA1NDkwMjksIm5iZiI6MTc4MDU0OTAyOSwiZXhwIjoxODExNjUzMDQ5LCJkYXRhIjp7InVpZCI6MTUzMTY5OCwidG9rZW4iOiJkNmY5NmMyNDg0Nzg4OWY5NmQ3Y2QzNTY4NjI0Mzk4MSJ9fQ.nmc-3oOhSQSaghTmgXjKLRih2KQrIBQEmOEf4rJ0hqg';

let sessionInstance = null;
function getSession() {
    if (!sessionInstance) {
        sessionInstance = new Session({ clientIdentifier: 'chrome_120', insecureSkipVerify: false });
    }
    return sessionInstance;
}

function decodeHtmlEntities(str) {
    if (!str) return '';
    return str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
              .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'");
}

async function requestTls(config) {
    const session = getSession();
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url;
    const headers = config.headers || {};

    if (!headers['User-Agent'] && !headers['user-agent']) {
        headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    }

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            let response;
            let redirectCount = 0;
            let currentUrl = url;
            while (redirectCount < 5) {
                if (method === 'POST') {
                    response = await session.post(currentUrl, {
                        headers,
                        body: config.data,
                        timeout: (config.timeout || 30) * 1000
                    });
                } else {
                    response = await session.get(currentUrl, {
                        headers,
                        timeout: (config.timeout || 30) * 1000
                    });
                }

                if (response.status === 0) {
                    throw new Error(response.body || 'TLS connection failed');
                }

                if ([301, 302, 307, 308].includes(response.status)) {
                    let loc = response.headers['Location'] || response.headers['location'];
                    if (Array.isArray(loc)) loc = loc[0];
                    if (loc) {
                        currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href;
                        redirectCount++;
                        continue;
                    }
                }
                break;
            }

            return { status: response.status, text: response.body };
        } catch (e) {
            if (attempt < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            } else {
                return { status: 500, error: e.message };
            }
        }
    }
}

async function getTmdbMetadata(id, type = null) {
    let types = type ? [type] : ['movie', 'tv'];
    let html = '';
    let foundType = '';

    for (const t of types) {
        const url = `https://www.themoviedb.org/${t}/${id}?language=en-US`;
        const res = await requestTls({ url, method: 'GET' });
        if (res.status === 200) {
            html = res.text;
            foundType = t;
            break;
        }
    }

    if (!html) throw new Error('TMDB ID not found.');

    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';
    const images = [];

    const imageMatches = html.matchAll(/<meta property="og:image" content="([^"]+)"/gi);
    for (const match of imageMatches) {
        images.push(match[1].split('/').pop());
    }

    try {
        const backdropsUrl = `https://www.themoviedb.org/${foundType}/${id}/images/backdrops`;
        const backdropsRes = await requestTls({ url: backdropsUrl, method: 'GET' });
        if (backdropsRes.status === 200) {
            const bRegex = /\/t\/p\/[^/]+\/([^/]+\.(?:jpg|png|webp|jpeg))/gi;
            let bMatch;
            while ((bMatch = bRegex.exec(backdropsRes.text)) !== null) {
                images.push(bMatch[1]);
            }
        }
    } catch (e) {
        console.error('Backdrops fetch failed:', e);
    }

    return { title, images: [...new Set(images)], type: foundType };
}

async function searchShowbox(title, type) {
    const cleanTitle = title.replace(/[^a-zA-Z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
    const url = `https://www.showbox.media/search?keyword=${encodeURIComponent(cleanTitle)}`;
    console.log('[Showbox] Searching keyword:', cleanTitle, 'URL:', url);
    const res = await requestTls({ url, method: 'GET' });
    console.log('[Showbox] Search response status:', res.status);
    if (res.status !== 200) {
        throw new Error(`Showbox search failed. Status: ${res.status}`);
    }

    const html = res.text;
    const regex = /href="(\/(?:movie|tv)\/[^"]+)" title="([^"]+)"/g;
    const results = [];
    const seen = new Set();

    let match;
    while ((match = regex.exec(html)) !== null) {
        const path = match[1];
        const itemTitle = match[2];
        if (!seen.has(path)) {
            seen.add(path);
            const isMovie = path.startsWith('/movie/m-');
            const isTv = path.startsWith('/tv/t-');

            if ((type === 'movie' && isMovie) || (type === 'tv' && isTv)) {
                results.push({ path, title: itemTitle });
            }
        }
    }
    return results;
}

async function findMatchingShowboxDetails(candidates, tmdbImages) {
    for (const cand of candidates) {
        console.log(`[Showbox] Checking: ${cand.path}`);
        await new Promise(r => setTimeout(r, 1000));

        try {
            const res = await requestTls({ url: `https://www.showbox.media${cand.path}`, method: 'GET' });
            if (res.status !== 200) continue;

            const html = res.text;
            const bgMatch = html.match(/cover_follow"[\s\S]*?background-image:\s*url\(([^)]+)\)/i);
            if (!bgMatch) continue;

            const bgUrl = bgMatch[1].replace(/['"&)]/g, '').trim();
            const bgFilename = bgUrl.split('/').pop();

            const isMatch = tmdbImages.some(img => img.toLowerCase() === bgFilename.toLowerCase());
            if (isMatch) {
                const detailIdMatch = html.match(/\/(?:movie|tv)\/detail\/(\d+)/i);
                const ajaxIdMatch = html.match(/data:\s*\{\s*['"]?id['"]?:\s*(\d+),\s*['"]?type['"]?:\s*(\d+)\s*\}/i);
                const id = detailIdMatch ? parseInt(detailIdMatch[1]) : (ajaxIdMatch ? parseInt(ajaxIdMatch[1]) : null);
                const type = cand.path.startsWith('/movie/') ? 1 : 2;

                if (id) return { id, type, html, path: cand.path };
            }
        } catch (e) {
            console.error(`Failed to parse details for ${cand.path}:`, e.message);
        }
    }
    return null;
}

async function traverseFebboxDirectory(shareKey, parentId = 0) {
    let files = [];
    const url = `https://www.febbox.com/file/file_share_list?share_key=${shareKey}&parent_id=${parentId}&is_html=1`;
    const headers = {
        'Cookie': FEBBOX_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };

    const res = await requestTls({ url, method: 'GET', headers });
    if (res.status !== 200) return files;

    const data = res.text ? JSON.parse(res.text) : {};
    if (data.code !== 1 || !data.html) return files;

    const html = data.html;
    const fileRegex = /class="file\s*"[^>]*data-id="(\d+)"[\s\S]*?<p class="file_name">([\s\S]*?)<\/p>/g;
    let match;
    while ((match = fileRegex.exec(html)) !== null) {
        files.push({
            fid: match[1],
            name: match[2].replace(/<[^>]+>/g, '').trim(),
            is_dir: false
        });
    }

    const dirRegex = /class="[^"]*open_dir[^"]*"[^>]*data-id="(\d+)"[^>]*data-path="([^"]+)"/g;
    const subdirs = [];
    while ((match = dirRegex.exec(html)) !== null) {
        subdirs.push({ id: match[1], name: match[2].trim() });
    }

    for (const dir of subdirs) {
        const subFiles = await traverseFebboxDirectory(shareKey, dir.id);
        files = files.concat(subFiles);
    }
    return files;
}

async function extractPlayerUrls(fid, shareKey) {
    const url = 'https://www.febbox.com/file/player';
    const headers = {
        'Cookie': FEBBOX_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://www.febbox.com',
        'Referer': `https://www.febbox.com/share/${shareKey}`,
        'X-Requested-With': 'XMLHttpRequest'
    };
    const data = `fid=${fid}&share_key=${shareKey}`;

    const res = await requestTls({ url, method: 'POST', headers, data });
    if (res.status !== 200) return null;

    const html = res.text;
    const sourcesMatch = html.match(/var\s+sources\s*=\s*(\[[\s\S]*?\]);/);
    let sources = [];
    if (sourcesMatch) {
        try {
            sources = JSON.parse(sourcesMatch[1]);
        } catch (e) {
            console.error('Failed to parse sources:', e);
        }
    }

    const fileMatch = html.match(/file:\s*'(https?:\/\/[^']+)'/);
    const playlistFile = fileMatch ? fileMatch[1] : null;

    return { sources, playlistFile };
}

function findMatchedEpisodeFile(files, season, episode) {
    const sStr = String(season).padStart(2, '0');
    const eStr = String(episode).padStart(2, '0');
    const patterns = [
        new RegExp(`s${season}e${episode}`, 'i'),
        new RegExp(`s${sStr}e${eStr}`, 'i'),
        new RegExp(`season\\s*${season}\\s*episode\\s*${episode}`, 'i'),
        new RegExp(`[^\\d]${season}x${eStr}[^\\d]`, 'i'),
        new RegExp(`[^\\d]${season}x${episode}[^\\d]`, 'i'),
        new RegExp(`e(?:ps|p)?\\s*${episode}[^\\d]`, 'i')
    ];

    for (const pat of patterns) {
        for (const f of files) {
            if (pat.test(f.name)) return f;
        }
    }

    const fallbackPat = new RegExp(`(?:ep|e|episode)\\s*${episode}\\b`, 'i');
    for (const f of files) {
        if (fallbackPat.test(f.name)) return f;
    }
    return null;
}

async function getShowboxStreams(tmdbId, type, season = "", episode = "") {
    const reqSeason = season ? parseInt(season) : 1;
    const reqEpisode = episode ? parseInt(episode) : 1;
    const normalizedType = (type === "series" || type === "tv") ? "tv" : "movie";

    try {
        console.log(`[Showbox] Resolving TMDB ID: ${tmdbId}, Type: ${normalizedType}`);
        const tmdbMeta = await getTmdbMetadata(tmdbId, normalizedType);

        if (tmdbMeta.images.length === 0) {
            return { success: false, error: 'No TMDB backdrops found.' };
        }

        const searchResults = await searchShowbox(tmdbMeta.title, tmdbMeta.type);
        if (searchResults.length === 0) {
            return { success: false, error: `Not found on Showbox: "${tmdbMeta.title}".` };
        }

        const showboxDetails = await findMatchingShowboxDetails(searchResults, tmdbMeta.images);
        if (!showboxDetails) {
            return { success: false, error: 'Details match failed.' };
        }

        console.log(`[Showbox] Match found: ${showboxDetails.id}`);
        await new Promise(r => setTimeout(r, 1000));

        const shareLinkRes = await requestTls({
            url: `https://www.showbox.media/index/share_link?id=${showboxDetails.id}&type=${showboxDetails.type}`,
            method: 'GET',
            headers: {
                'Referer': `https://www.showbox.media${showboxDetails.path}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (shareLinkRes.status !== 200) {
            return { success: false, error: 'Failed to retrieve share link.' };
        }

        const shareData = JSON.parse(shareLinkRes.text);
        if (shareData.code !== 1 || !shareData.data || !shareData.data.link) {
            return { success: false, error: 'No share link returned.' };
        }

        const shareKey = shareData.data.link.split('/').pop();
        const files = await traverseFebboxDirectory(shareKey);

        if (files.length === 0) {
            return { success: false, error: 'Folder is empty.' };
        }

        const streams = [];

        const addStreamsFromFebbox = (file_name, sources, playlist_file) => {
            if (playlist_file) {
                streams.push({
                    server: `Showbox HLS (${file_name})`,
                    url: playlist_file,
                    quality: 'Auto',
                    type: 'm3u8',
                    headers: {
                        'Referer': `https://www.febbox.com/share/${shareKey}`,
                        'Cookie': FEBBOX_COOKIE,
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                    },
                    provider: 'Showbox'
                });
            }
            if (Array.isArray(sources)) {
                sources.forEach(src => {
                    if (src.file) {
                        streams.push({
                            server: `Showbox ${src.label || 'Direct'} (${file_name})`,
                            url: src.file,
                            quality: src.label || 'Auto',
                            type: 'mp4',
                            headers: {
                                'Referer': `https://www.febbox.com/share/${shareKey}`,
                                'Cookie': FEBBOX_COOKIE,
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                            },
                            provider: 'Showbox'
                        });
                    }
                });
            }
        };

        if (tmdbMeta.type === 'movie') {
            for (const f of files) {
                const extraction = await extractPlayerUrls(f.fid, shareKey);
                if (extraction) {
                    addStreamsFromFebbox(f.name, extraction.sources, extraction.playlistFile);
                }
            }
        } else {
            const matchedFile = findMatchedEpisodeFile(files, reqSeason, reqEpisode);
            if (!matchedFile) {
                return { success: false, error: `S${reqSeason}E${reqEpisode} not found in directory.` };
            }

            const extraction = await extractPlayerUrls(matchedFile.fid, shareKey);
            if (!extraction) {
                return { success: false, error: 'Failed to extract player URLs for matched file.' };
            }

            addStreamsFromFebbox(matchedFile.name, extraction.sources, extraction.playlistFile);
        }

        return {
            success: true,
            streams: streams
        };

    } catch (e) {
        console.error('[Showbox Error]', e);
        return { success: false, error: e.message };
    }
}

module.exports = { getShowboxStreams };
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://animesalt.ac/';
const AJAX_URL = 'https://animesalt.ac/wp-admin/admin-ajax.php';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

async function getStreamUrl(id) {
    try {
        const streamUrl = `https://as-cdn21.top/player/index.php?data=${id}&do=getVideo`;
        const { data } = await axios.post(streamUrl, null, {
            headers: {
                'Referer': `https://as-cdn21.top/video/${id}`,
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': USER_AGENT,
                'Origin': 'https://as-cdn21.top',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            }
        });
        return data;
    } catch (error) {
        console.error(`Error fetching stream for ${id}:`, error.message);
        return null;
    }
}

function parseItem($, el) {
    const $el = $(el);
    const title = $el.find('.entry-title, .chart-title, .title, h2').first().text().trim();
    const link = $el.find('a.lnk-blk, a.chart-poster, a').first().attr('href');
    const imgEl = $el.find('img');
    const image = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src');
    const quality = $el.find('.post-ql, .Qlty').first().text().trim();
    const episode = $el.find('.num-epi, .episodes').first().text().trim();
    
    let type = 'unknown';
    const classes = ($el.attr('class') || '').toLowerCase();
    const parentClasses = ($el.closest('li').attr('class') || '').toLowerCase();
    const combinedClasses = (classes + ' ' + parentClasses);
    
    if (link) {
        if (link.includes('/series/')) type = 'series';
        else if (link.includes('/movies/')) type = 'movie';
        else if (link.includes('/episode/')) type = 'episode';
    }
    
    if (type === 'unknown') {
        if (combinedClasses.includes('type-series') || combinedClasses.includes('series')) type = 'series';
        else if (combinedClasses.includes('type-movies') || combinedClasses.includes('movies')) type = 'movie';
        else if (combinedClasses.includes('episodes')) type = 'episode';
    }
    
    const watchText = $el.find('.watch').text().toLowerCase();
    if (watchText.includes('serie')) type = 'series';
    else if (watchText.includes('movie')) type = 'movie';

    const genres = [];
    combinedClasses.split(' ').forEach(cls => {
        if (cls.startsWith('category-')) {
            const genre = cls.replace('category-', '').replace(/-/g, ' ');
            if (genre && !['series', 'movies', 'completed', 'english', 'hindi', 'japanese', 'tamil', 'telugu'].includes(genre)) {
                genres.push(genre.charAt(0).toUpperCase() + genre.slice(1));
            }
        }
    });

    if (title && link) {
        const slug = link.split('/').filter(Boolean).pop();
        return {
            title,
            link,
            slug,
            api_route: type !== 'unknown' ? `/api/anime/details/${type}/${slug}` : null,
            image: image ? (image.startsWith('//') ? 'https:' + image : image) : null,
            type,
            quality: quality || null,
            episode: episode || null,
            genres: [...new Set(genres)]
        };
    }
    return null;
}

async function getHome() {
    const { data } = await axios.get(BASE_URL, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(data);
    const sections = {};

    $('.section, .widget, .widget_list_movies_series').each((i, section) => {
        const sectionTitle = $(section).find('.section-title, h3, h2').first().text().trim();
        if (!sectionTitle) return;

        const items = [];
        $(section).find('article.post, .chart-item, li.post').each((j, el) => {
            const item = parseItem($, el);
            if (item) items.push(item);
        });

        if (items.length > 0) {
            let finalTitle = sectionTitle;
            let counter = 1;
            while (sections[finalTitle]) {
                finalTitle = `${sectionTitle} ${++counter}`;
            }
            sections[finalTitle] = items;
        }
    });
    return sections;
}

async function searchAnime(query, page = 1) {
    let results = [];
    if (page === 1) {
        const searchUrl = `${BASE_URL}?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(data);
        $('article.post, li.post').each((i, el) => {
            const item = parseItem($, el);
            if (item) results.push(item);
        });
    } else {
        const params = new URLSearchParams();
        params.append('action', 'torofilm_infinite_scroll');
        params.append('page', page);
        params.append('query_type', 'search');
        params.append('query_args[s]', query);

        const { data } = await axios.post(AJAX_URL, params, {
            headers: {
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (data.success && data.data.content) {
            const $ = cheerio.load(data.data.content);
            $('article.post, li.post').each((i, el) => {
                const item = parseItem($, el);
                if (item) results.push(item);
            });
        }
    }
    return results;
}

async function getMovieDetails(slug) {
    const url = `${BASE_URL}movies/${slug}/`;
    const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(response.data);
    const details = {};

    details.title = $('.bd h1').text().trim() || $('title').text().split('-')[0].trim();
    details.description = $('#overview-text p').text().trim() || $('.overviewCss').text().trim();
    details.image = $('.bd img.lazyload').first().attr('data-src') || $('.bd img').first().attr('src');
    
    details.genres = [];
    $('a[href*="/category/genre/"]').each((i, el) => {
        details.genres.push({ name: $(el).text().trim(), slug: $(el).attr('href').split('/').filter(Boolean).pop() });
    });

    details.languages = [];
    $('a[href*="/category/language/"]').each((i, el) => {
        details.languages.push({ name: $(el).text().trim(), slug: $(el).attr('href').split('/').filter(Boolean).pop() });
    });

    $('.bd div[style*="background-color: rgba(255, 255, 255, 0.05)"]').each((i, el) => {
        const text = $(el).text().trim();
        if (text.match(/^\d{4}$/)) details.year = text;
        else if (text.includes('h') || text.includes('m')) details.duration = text;
    });

    details.servers = [];
    const serverPromises = [];
    $('.video-player iframe, .video iframe').each((i, el) => {
        const src = $(el).attr('data-src') || $(el).attr('src');
        if (src && !src.startsWith('data:')) {
            const server = { id: i, name: `Server ${i + 1}`, url: src };
            details.servers.push(server);
            if (src.includes('as-cdn21.top/video/')) {
                const id = src.split('/').pop();
                serverPromises.push(getStreamUrl(id).then(d => { if (d) { server.streamData = d; server.hls = d.videoSource; } }));
            }
        }
    });
    await Promise.all(serverPromises);

    $('.server-grid .server-btn').each((i, el) => {
        if (details.servers[i]) {
            details.servers[i].name = $(el).find('.server-name').text().trim();
            details.servers[i].info = $(el).find('.server-info').text().trim();
        }
    });

    return details;
}

async function getSeriesDetails(slug) {
    const url = `${BASE_URL}series/${slug}/`;
    const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(response.data);
    const details = {};

    details.title = $('.bd h1').text().trim() || $('title').text().split('-')[0].trim();
    details.description = $('#overview-text p').text().trim() || $('.overviewCss').text().trim();
    details.image = $('.bd img.lazyload').first().attr('data-src') || $('.bd img').first().attr('src');
    
    details.genres = [];
    $('a[href*="/category/genre/"]').each((i, el) => {
        details.genres.push({ name: $(el).text().trim(), slug: $(el).attr('href').split('/').filter(Boolean).pop() });
    });

    details.languages = [];
    $('a[href*="/category/language/"]').each((i, el) => {
        details.languages.push({ name: $(el).text().trim(), slug: $(el).attr('href').split('/').filter(Boolean).pop() });
    });

    $('.bd div[style*="background-color: rgba(255, 255, 255, 0.05)"]').each((i, el) => {
        const text = $(el).text().trim();
        if (text.match(/^\d{4}$/)) details.year = text;
        else if (text.includes('Seasons')) details.seasons = text.split(' ')[0];
        else if (text.includes('Episodes')) details.episodeCount = text.split(' ')[0];
    });

    details.episodes = [];
    $('ul#episode_by_temp li, article.post.episodes').each((i, el) => {
        const episode = {};
        episode.title = $(el).find('.entry-title').text().trim();
        episode.episode_number = $(el).find('.num-epi').text().trim();
        const link = $(el).find('a.lnk-blk, a').first().attr('href');
        episode.link = link;
        if (link) {
            const epSlug = link.split('/').filter(Boolean).pop();
            episode.slug = epSlug;
            episode.api_route = `/api/anime/details/episode/${epSlug}`;
        }
        const img = $(el).find('img');
        episode.thumbnail = img.attr('data-src') || img.attr('src');
        if (episode.title) details.episodes.push(episode);
    });

    return details;
}

async function getEpisodeDetails(slug) {
    const url = `${BASE_URL}episode/${slug}/`;
    const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(response.data);
    const details = {};

    details.title = $('.bd h1').text().trim() || $('title').text().split('-')[0].trim();
    details.episode_info = $('.bd div[style*="color: var(--dim-text)"]').first().text().trim();
    details.image = $('.bghd img').first().attr('data-src') || $('.bghd img').first().attr('src');
    
    details.servers = [];
    const serverPromises = [];
    $('.video-player iframe, .video iframe').each((i, el) => {
        const src = $(el).attr('data-src') || $(el).attr('src');
        if (src && !src.startsWith('data:')) {
            const server = { id: i, name: `Server ${i + 1}`, url: src };
            details.servers.push(server);
            if (src.includes('as-cdn21.top/video/')) {
                const id = src.split('/').pop();
                serverPromises.push(getStreamUrl(id).then(d => { if (d) { server.streamData = d; server.hls = d.videoSource; } }));
            }
        }
    });
    await Promise.all(serverPromises);

    details.prev_episode = $('a[href*="/episode/"]').has('svg polygon[points="19 20 9 12 19 4 19 20"]').attr('href');
    details.next_episode = $('a[href*="/episode/"]').has('svg polygon[points="5 4 15 12 5 20 5 4"]').attr('href');
    details.series_link = $('a[href*="/series/"]').has('svg line[x1="8"]').attr('href');

    if (details.prev_episode) details.prev_episode_route = `/api/anime/details/episode/${details.prev_episode.split('/').filter(Boolean).pop()}`;
    if (details.next_episode) details.next_episode_route = `/api/anime/details/episode/${details.next_episode.split('/').filter(Boolean).pop()}`;
    if (details.series_link) details.series_route = `/api/anime/details/series/${details.series_link.split('/').filter(Boolean).pop()}`;

    details.recommended = [];
    $('.carousel article').each((i, el) => {
        const item = parseItem($, el);
        if (item) details.recommended.push(item);
    });

    return details;
}

module.exports = {
    getHome,
    searchAnime,
    getMovieDetails,
    getSeriesDetails,
    getEpisodeDetails
};
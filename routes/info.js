const router = require('express').Router();

const PROVIDER_LIST = [
  { id: 'cinemaos',    name: 'CinemaOS',    supports: ['movie', 'tv'], requiresImdb: true },
  { id: 'vidlux',      name: 'VidLux',      supports: ['movie', 'tv'], requiresImdb: false },
  { id: 'vidrock',     name: 'VidRock',     supports: ['movie', 'tv'], requiresImdb: false },
  { id: 'webstreamer', name: 'Webstreamer', supports: ['movie', 'tv'], requiresImdb: true },
  { id: 'showbox',     name: 'ShowBox',     supports: ['movie', 'tv'], requiresImdb: false },
  { id: 'pikashow',    name: 'Pikashow',    supports: ['movie'],       requiresImdb: false, note: 'Movies only' },
  { id: 'rive',        name: 'Rive',        supports: ['movie', 'tv'], requiresImdb: false },
  { id: 'challenge',   name: 'Challenge',   supports: ['movie', 'tv'], requiresImdb: true },
  { id: 'anime',       name: 'AnimeSalt',   supports: ['anime'],       note: 'Anime-only' },
];

router.get('/providers', (_req, res) => {
  res.json({ success: true, count: PROVIDER_LIST.length, providers: PROVIDER_LIST });
});

router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

router.get('/docs', (_req, res) => {
  res.json({
    title: 'Vetra Providers API',
    version: '1.0.0',
    endpoints: [
      { method: 'GET', path: '/api/streams',            desc: 'All providers in parallel',          example: '/api/streams?tmdbId=550&type=movie&imdbId=tt0137523' },
      { method: 'GET', path: '/api/streams/:provider',  desc: 'Single provider',                    example: '/api/streams/cinemaos?tmdbId=550&type=movie&imdbId=tt0137523' },
      { method: 'GET', path: '/api/raw/:provider',      desc: 'Raw provider response',              example: '/api/raw/vidrock?tmdbId=550&type=movie' },
      { method: 'GET', path: '/api/anime/search',       desc: 'Search anime',                       example: '/api/anime/search?q=naruto' },
      { method: 'GET', path: '/api/anime/trending',     desc: 'Trending anime',                     example: '/api/anime/trending' },
      { method: 'GET', path: '/api/anime/latest',       desc: 'Latest episode releases',            example: '/api/anime/latest' },
      { method: 'GET', path: '/api/anime/info/:id',     desc: 'Anime info by slug/id',              example: '/api/anime/info/naruto-shippuuden' },
      { method: 'GET', path: '/api/anime/episode/:id',  desc: 'Anime episode stream URL',           example: '/api/anime/episode/naruto-shippuuden-episode-1' },
      { method: 'GET', path: '/api/providers',          desc: 'List all providers' },
      { method: 'GET', path: '/api/health',             desc: 'Health check' },
    ],
  });
});

module.exports = router;
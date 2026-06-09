const router = require('express').Router();

function loadAnime() {
  try { return require('../providers/anime.provider'); }
  catch (e) { return null; }
}

router.get('/anime/search', async (req, res) => {
  const { q, page = 1 } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Missing param: q' });
  const m = loadAnime();
  if (!m) return res.status(503).json({ success: false, error: 'Anime provider unavailable' });
  try {
    const data = await m.searchAnime(q, Number(page));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/anime/trending', async (_req, res) => {
  const m = loadAnime();
  if (!m) return res.status(503).json({ success: false, error: 'Anime provider unavailable' });
  try {
    const data = await m.getTrending();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/anime/latest', async (_req, res) => {
  const m = loadAnime();
  if (!m) return res.status(503).json({ success: false, error: 'Anime provider unavailable' });
  try {
    const data = await m.getLatestEpisodes();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/anime/info/:id', async (req, res) => {
  const m = loadAnime();
  if (!m) return res.status(503).json({ success: false, error: 'Anime provider unavailable' });
  try {
    const data = await m.getAnimeInfo(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/anime/episode/:id', async (req, res) => {
  const m = loadAnime();
  if (!m) return res.status(503).json({ success: false, error: 'Anime provider unavailable' });
  try {
    const data = await m.getAnimeStreamUrl(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
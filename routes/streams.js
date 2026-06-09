const router = require('express').Router();
const axios = require('axios');

const FEBBOX_COOKIE = 'PHPSESSID=0sfc06aesk3cf3sq76rc66sr19; ui=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3ODA1NDkwMjksIm5iZiI6MTc4MDU0OTAyOSwiZXhwIjoxODExNjUzMDQ5LCJkYXRhIjp7InVpZCI6MTUzMTY5OCwidG9rZW4iOiJkNmY5NmMyNDg0Nzg4OWY5NmQ3Y2QzNTY4NjI0Mzk4MSJ9fQ.nmc-3oOhSQSaghTmgXjKLRih2KQrIBQEmOEf4rJ0hqg';

function load(name) {
  try { return require(`../providers/${name}`); }
  catch (e) { console.warn(`[Vetra] Could not load ${name}: ${e.message}`); return null; }
}

const PROVIDERS = {
  cinemaos:    true,
  vidlux:      true,
  vidrock:     true,
  webstreamer: true,
  showbox:     true,
  pikashow:    true,
  rive:        true,
  challenge:   true,
};

function missingParam(res, name) {
  return res.status(400).json({ success: false, error: `Missing required parameter: ${name}` });
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function rewriteUrls(result, baseUrl) {
  if (!result || typeof result !== 'object') return result;
  if (Array.isArray(result)) return result.map(item => rewriteUrls(item, baseUrl));

  const out = {};
  for (const [k, v] of Object.entries(result)) {
    if (k === 'url' && typeof v === 'string' && /\.(mp4|mkv|webm|m3u8|m3u)(\?|$)/i.test(v)) {
      const referer = result.headers?.Referer || result.headers?.referer || '';
      out['directUrl'] = v;
      out[k] = `${baseUrl}/api/proxy?url=${encodeURIComponent(v)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;
    } else if (k === 'headers' || k === 'directUrl') {
      out[k] = v;
    } else if (typeof v === 'object' && v !== null) {
      out[k] = rewriteUrls(v, baseUrl);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function fetchAllProviders(params, timeoutMs = 30000) {
  const { tmdbId, imdbId, type, season, episode, title, year } = params;
  const isTV = type === 'tv' || type === 'series';

  const tasks = {
    cinemaos: async () => {
      const m = load('cinemaos.provider');
      if (!m) return null;
      return m.getCinemaOSStreams(tmdbId, imdbId, type, season, episode);
    },
    vidlux: async () => {
      const m = load('vidlux.provider');
      if (!m) return null;
      return m.getVidluxStreams(tmdbId, type, season, episode, null, title, year);
    },
    vidrock: async () => {
      const m = load('vidrock.provider');
      if (!m) return null;
      return m.getVidRockStreams(tmdbId, type, season, episode);
    },
    webstreamer: async () => {
      const m = load('webstreamer.provider');
      if (!m) return null;
      return m.getWebstreamerStreams(imdbId, type, season, episode);
    },
    showbox: async () => {
      const m = load('showbox.provider');
      if (!m) return null;
      return m.getShowboxStreams(tmdbId, type, season, episode);
    },
    pikashow: async () => {
      if (isTV) return { skipped: true, reason: 'Pikashow supports movies only' };
      const m = load('pikashow.provider');
      if (!m) return null;
      return m.getPikashowStreams(tmdbId, type, season, episode);
    },
    rive: async () => {
      const m = load('rive.provider');
      if (!m) return null;
      return m.getRiveStreams(tmdbId, type, season, episode);
    },
    challenge: async () => {
      const m = load('challenge.provider');
      if (!m) return null;
      return m.getChallengeStreams(tmdbId, imdbId, title, year, type, season, episode);
    },
  };

  const withTimeout = (fn, name) =>
    Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)),
    ]).catch(err => ({ error: err.message }));

  const entries = Object.entries(tasks).map(([name, fn]) => [name, withTimeout(fn, name)]);
  const results = await Promise.all(entries.map(([, p]) => p));
  return Object.fromEntries(entries.map(([name], i) => [name, results[i]]));
}

// GET /api/streams
router.get('/streams', async (req, res) => {
  const { tmdbId, imdbId, type, season, episode, title, year } = req.query;
  if (!tmdbId) return missingParam(res, 'tmdbId');
  if (!type)   return missingParam(res, 'type');

  const start = Date.now();
  try {
    const raw = await fetchAllProviders({ tmdbId, imdbId, type, season, episode, title, year });
    const results = rewriteUrls(raw, getBaseUrl(req));
    res.json({ success: true, took: `${Date.now() - start}ms`, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/streams/:provider
router.get('/streams/:provider', async (req, res) => {
  const { provider } = req.params;
  const { tmdbId, imdbId, type, season = '', episode = '', title, year } = req.query;

  if (!tmdbId) return missingParam(res, 'tmdbId');
  if (!type)   return missingParam(res, 'type');
  if (!PROVIDERS[provider]) {
    return res.status(404).json({
      success: false,
      error: `Unknown provider: ${provider}`,
      available: Object.keys(PROVIDERS),
    });
  }

  const start = Date.now();
  try {
    let raw;
    switch (provider) {
      case 'cinemaos':    { const m = load('cinemaos.provider');    raw = await m.getCinemaOSStreams(tmdbId, imdbId, type, season, episode); break; }
      case 'vidlux':      { const m = load('vidlux.provider');      raw = await m.getVidluxStreams(tmdbId, type, season, episode, null, title, year); break; }
      case 'vidrock':     { const m = load('vidrock.provider');     raw = await m.getVidRockStreams(tmdbId, type, season, episode); break; }
      case 'webstreamer': { const m = load('webstreamer.provider'); raw = await m.getWebstreamerStreams(imdbId, type, season, episode); break; }
      case 'showbox':     { const m = load('showbox.provider');     raw = await m.getShowboxStreams(tmdbId, type, season, episode); break; }
      case 'pikashow':    { const m = load('pikashow.provider');    raw = await m.getPikashowStreams(tmdbId, type, season, episode); break; }
      case 'rive':        { const m = load('rive.provider');        raw = await m.getRiveStreams(tmdbId, type, season, episode); break; }
      case 'challenge':   { const m = load('challenge.provider');   raw = await m.getChallengeStreams(tmdbId, imdbId, title, year, type, season, episode); break; }
    }
    const data = rewriteUrls(raw, getBaseUrl(req));
    res.json({ success: true, provider, took: `${Date.now() - start}ms`, data });
  } catch (err) {
    res.status(500).json({ success: false, provider, error: err.message });
  }
});

// GET /api/raw/:provider
router.get('/raw/:provider', async (req, res) => {
  const { provider } = req.params;
  const { tmdbId, imdbId, type, season = '', episode = '', title, year } = req.query;

  if (!tmdbId) return missingParam(res, 'tmdbId');
  if (!type)   return missingParam(res, 'type');

  const start = Date.now();
  try {
    let data;
    switch (provider) {
      case 'cinemaos':    { const m = load('cinemaos.provider');    data = await m.getCinemaOSStreams(tmdbId, imdbId, type, season, episode); break; }
      case 'vidlux':      { const m = load('vidlux.provider');      data = await m.getVidluxStreams(tmdbId, type, season, episode, null, title, year); break; }
      case 'vidrock':     { const m = load('vidrock.provider');     data = await m.getVidRockStreams(tmdbId, type, season, episode); break; }
      case 'webstreamer': { const m = load('webstreamer.provider'); data = await m.getWebstreamerStreams(imdbId, type, season, episode); break; }
      case 'showbox':     { const m = load('showbox.provider');     data = await m.getShowboxStreams(tmdbId, type, season, episode); break; }
      case 'pikashow':    { const m = load('pikashow.provider');    data = await m.getPikashowStreams(tmdbId, type, season, episode); break; }
      case 'rive':        { const m = load('rive.provider');        data = await m.getRiveStreams(tmdbId, type, season, episode); break; }
      case 'challenge':   { const m = load('challenge.provider');   data = await m.getChallengeStreams(tmdbId, imdbId, title, year, type, season, episode); break; }
      default: return res.status(404).json({ success: false, error: `Unknown provider: ${provider}` });
    }
    res.json({ success: true, provider, took: `${Date.now() - start}ms`, data });
  } catch (err) {
    res.status(500).json({ success: false, provider, error: err.message });
  }
});

// GET /api/proxy
router.get('/proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'Missing required param: url' });

  let decodedUrl, origin, decodedReferer, filename, isM3u8, isMp4, isShowbox;

  try {
    decodedUrl     = decodeURIComponent(url);
    origin         = new URL(decodedUrl).origin;
    decodedReferer = referer ? decodeURIComponent(referer) : origin;
    filename       = decodedUrl.split('/').pop().split('?')[0] || 'video.mp4';
    isM3u8         = /\.m3u8?(\?|$)/i.test(decodedUrl);
    isMp4          = /\.(mp4|mkv|webm)(\?|$)/i.test(decodedUrl);
    isShowbox      = decodedUrl.includes('hakunaymatata.com') ||
                     decodedUrl.includes('febbox.com') ||
                     decodedUrl.includes('showbox');
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid url parameter' });
  }

  const rangeHeader = req.headers['range'];
  const reqHeaders = {
    'Referer':    isShowbox ? 'https://www.febbox.com/' : decodedReferer,
    'Origin':     isShowbox ? 'https://www.febbox.com' : origin,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':     '*/*',
    'Connection': 'keep-alive',
  };
  if (isShowbox)   reqHeaders['Cookie'] = FEBBOX_COOKIE;
  if (rangeHeader) reqHeaders['Range']  = rangeHeader;

  let response;
  try {
    response = await axios({
      method: 'GET',
      url: decodedUrl,
      responseType: 'stream',
      headers: reqHeaders,
      timeout: 0,
      maxRedirects: 5,
    });
  } catch (axiosErr) {
    const status = axiosErr.response?.status;
    if (status === 403 || status === 429 || status === 401) {
      console.log(`[Proxy] Axios got ${status}, falling back to TLS client...`);
      try {
        const { Session } = require('node-tls-client');
        const session = new Session({ clientIdentifier: 'chrome_120', insecureSkipVerify: false });
        const tlsRes = await session.get(decodedUrl, { headers: reqHeaders, timeout: 60000 });

        if (tlsRes.status === 403) {
          return res.status(403).json({
            success: false,
            error: 'CDN denied access. ShowBox token may be expired — refetch /api/streams/showbox for a fresh URL.',
          });
        }

        res.status(tlsRes.status);
        if (isMp4)       res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        else if (isM3u8) res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Type', tlsRes.headers['content-type'] || 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        if (tlsRes.headers['content-length']) res.setHeader('Content-Length', tlsRes.headers['content-length']);
        if (tlsRes.headers['content-range'])  res.setHeader('Content-Range',  tlsRes.headers['content-range']);
        return res.send(tlsRes.body);
      } catch (tlsErr) {
        return res.status(500).json({ success: false, error: `TLS fallback failed: ${tlsErr.message}` });
      }
    }
    return res.status(axiosErr.response?.status || 500).json({ success: false, error: axiosErr.message });
  }

  res.status(response.status);
  if (isMp4)       res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  else if (isM3u8) res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Type', response.headers['content-type'] || (isM3u8 ? 'application/vnd.apple.mpegurl' : 'video/mp4'));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range');

  const forward = ['content-length', 'content-range', 'cache-control', 'etag', 'last-modified'];
  forward.forEach(h => { if (response.headers[h]) res.setHeader(h, response.headers[h]); });

  response.data.pipe(res);
  req.on('close', () => { response.data.destroy(); });
  response.data.on('error', err => {
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  });
});

module.exports = router;
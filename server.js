const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/api', require('./routes/streams'));
app.use('/api', require('./routes/anime'));
app.use('/api', require('./routes/info'));

app.get('/', (_req, res) => {
  res.json({
    name: 'Vetra Providers API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/docs',
    endpoints: {
      streams: {
        'GET /api/streams': 'All providers parallel',
        'GET /api/streams/:provider': 'Single provider',
        'GET /api/raw/:provider': 'Raw response',
      },
      anime: {
        'GET /api/anime/search?q=': 'Search anime',
        'GET /api/anime/trending': 'Trending',
        'GET /api/anime/episode/:id': 'Episode stream',
        'GET /api/anime/info/:id': 'Anime info',
      },
      info: {
        'GET /api/providers': 'List providers',
        'GET /api/health': 'Health check',
        'GET /api/docs': 'API docs',
      },
    },
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[GlobalError]', err.message);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Vetra Providers API running at http://localhost:${PORT}`);
  console.log(`📋 Docs: http://localhost:${PORT}/api/docs\n`);
});

module.exports = app;
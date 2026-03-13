import * as fs from 'node:fs';
import * as path from 'node:path';
import express from 'express';
import { addGame, getCachedGameIds, readGames } from './games';
import { getHeadless, getRecentRuns, getRun, setHeadless, startRun } from './runner';
import { buildGameUrls } from './url-builder';

const app = express();
const PORT = 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get('/api/settings', (_req, res) => {
  res.json({ headless: getHeadless() });
});

app.patch('/api/settings', (req, res) => {
  const { headless } = req.body as { headless?: unknown };

  if (typeof headless !== 'boolean') {
    res.status(400).json({ error: 'headless must be a boolean' });
    return;
  }

  setHeadless(headless);
  res.json({ headless: getHeadless() });
});

app.get('/api/games', (_req, res) => {
  const games = readGames();
  const cached = getCachedGameIds();

  res.json(
    games.map((g) => {
      return { ...g, cached: cached.has(g.gameId) };
    }),
  );
});

app.post('/api/games', (req, res) => {
  const { gameId, name, channel, mode } = req.body as {
    gameId?: unknown;
    name?: unknown;
    channel?: unknown;
    mode?: unknown;
  };

  if (typeof gameId !== 'string' || typeof name !== 'string') {
    res.status(400).json({ error: 'gameId and name are required strings' });
    return;
  }

  if (channel !== 'desktop' && channel !== 'mobile' && channel !== 'both') {
    res.status(400).json({ error: 'channel must be desktop, mobile, or both' });
    return;
  }

  if (mode !== 'demo' && mode !== 'real') {
    res.status(400).json({ error: 'mode must be demo or real' });
    return;
  }

  let urls: { url: string; mobileUrl?: string };

  try {
    urls = buildGameUrls(gameId, channel, mode);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
    return;
  }
  try {
    addGame({ gameId, name, ...urls });
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
    return;
  }
  res.status(201).json({ gameId });
});

app.post('/api/runs', (req, res) => {
  const { gameIds } = req.body as { gameIds?: string[] };

  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    res.status(400).json({ error: 'gameIds must be a non-empty array' });
    return;
  }

  const result = startRun(gameIds);

  if ('error' in result) {
    res.status(409).json(result);
    return;
  }

  res.status(201).json(result);
});

app.get('/api/runs', (_req, res) => {
  res.json(getRecentRuns(50));
});

app.get('/api/runs/:id', (req, res) => {
  const record = getRun(req.params.id);

  if (!record) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  res.json(record);
});

app.get('/api/screenshots/:gameId/:filename', (req, res) => {
  const safe = (s: string) => {
    return /^[\w.-]+$/.test(s);
  };

  if (!safe(req.params.gameId) || !safe(req.params.filename)) {
    res.status(400).send('Invalid path');
    return;
  }

  const filePath = path.resolve('screenshots', req.params.gameId, req.params.filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Not found');
    return;
  }

  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

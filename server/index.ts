import express from 'express';
import { GAMES } from '../tests/games';
import { getRecentRuns, getRun, startRun } from './runner';

const app = express();
const PORT = 3001;

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/api/games', (_req, res) => {
  res.json(GAMES);
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

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

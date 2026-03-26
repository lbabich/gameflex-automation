import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { makeGamesRouter } from './routes/games';
import { makeRunsRouter } from './routes/runs';
import { screenshotsRouter } from './routes/screenshots';
import { appRuntime } from './runtime';

const app = express();
const PORT = 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use('/api/games', makeGamesRouter(appRuntime));
app.use('/api/runs', makeRunsRouter(appRuntime));
app.use('/api/screenshots', screenshotsRouter);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

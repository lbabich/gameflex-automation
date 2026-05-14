import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { appRuntime } from '../runtime';
import { makeGamesRouter } from './game-catalog.router';
import { makeRunsRouter } from './run.router';
import { screenshotsRouter } from './screenshots.router';

const app = express();
const PORT = 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const DASHBOARD_DIST = path.join(import.meta.dirname, '../../..', 'dist', 'dashboard');
const serveDashboard = fs.existsSync(DASHBOARD_DIST);

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

if (serveDashboard) {
  app.use(express.static(DASHBOARD_DIST));
}

app.use('/api/games', makeGamesRouter(appRuntime));
app.use('/api/runs', makeRunsRouter(appRuntime));
app.use('/api/screenshots', screenshotsRouter);

if (serveDashboard) {
  app.get('*splat', (_req: Request, res: Response) => {
    res.sendFile(path.join(DASHBOARD_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

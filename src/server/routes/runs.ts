import { Router } from 'express';
import { cancelRun, getRecentRuns, getRun, startRun } from '../runner';
import type { AppRuntime } from '../runtime';

export function makeRunsRouter(_runtime: AppRuntime): Router {
  const router = Router();

  router.post('/', (req, res) => {
    const { gameIDs, projects } = req.body as { gameIDs?: string[]; projects?: string[] };

    if (!Array.isArray(gameIDs) || gameIDs.length === 0) {
      res.status(400).json({ error: 'gameIDs must be a non-empty array' });
      return;
    }

    const result = startRun(gameIDs, Array.isArray(projects) ? projects : undefined);

    if ('error' in result) {
      res.status(409).json(result);
      return;
    }

    res.status(201).json(result);
  });

  router.get('/', (_req, res) => {
    res.json(getRecentRuns(50));
  });

  router.get('/:id', (req, res) => {
    const record = getRun(req.params.id);

    if (!record) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.json(record);
  });

  router.delete('/:id', (req, res) => {
    const found = cancelRun(req.params.id);

    if (!found) {
      res.status(404).json({ error: 'Run not found or not active' });
      return;
    }

    res.sendStatus(204);
  });

  return router;
}

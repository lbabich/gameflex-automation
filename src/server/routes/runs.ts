import { Router } from 'express';
import { cancelRun, getRecentRuns, getRun, startRun } from '../runner';

export const runsRouter = Router();

runsRouter.post('/', (req, res) => {
  const { gameIds, projects } = req.body as { gameIds?: string[]; projects?: string[] };

  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    res.status(400).json({ error: 'gameIds must be a non-empty array' });
    return;
  }

  const result = startRun(gameIds, Array.isArray(projects) ? projects : undefined);

  if ('error' in result) {
    res.status(409).json(result);
    return;
  }

  res.status(201).json(result);
});

runsRouter.get('/', (_req, res) => {
  res.json(getRecentRuns(50));
});

runsRouter.get('/:id', (req, res) => {
  const record = getRun(req.params.id);

  if (!record) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  res.json(record);
});

runsRouter.delete('/:id', (req, res) => {
  const found = cancelRun(req.params.id);

  if (!found) {
    res.status(404).json({ error: 'Run not found or not active' });
    return;
  }

  res.sendStatus(204);
});

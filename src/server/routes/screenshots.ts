import * as fs from 'node:fs';
import * as path from 'node:path';
import { Router } from 'express';

export const screenshotsRouter = Router();

screenshotsRouter.get('/:gameID/:deviceType/:filename', (req, res) => {
  const safe = (s: string) => {
    return /^[\w.-]+$/.test(s);
  };

  if (!safe(req.params.gameID) || !safe(req.params.deviceType) || !safe(req.params.filename)) {
    res.status(400).send('Invalid path');
    return;
  }

  const filePath = path.resolve(
    'src/server/screenshots',
    req.params.gameID,
    req.params.deviceType,
    req.params.filename,
  );

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Not found');
    return;
  }

  res.sendFile(filePath);
});

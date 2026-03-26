import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Request, Response } from 'express';
import { Router } from 'express';

export const screenshotsRouter = Router();

screenshotsRouter.get(
  '/:folderID/:deviceType/:filename',
  (req: Request<Record<string, string>>, res: Response) => {
    const safe = (segment: string) => {
      return /^[\w.-]+$/.test(segment);
    };

    if (!safe(req.params.folderID) || !safe(req.params.deviceType) || !safe(req.params.filename)) {
      res.status(400).send('Invalid path');
      return;
    }

    const filePath = path.resolve(
      'src/server/screenshots',
      req.params.folderID,
      req.params.deviceType,
      req.params.filename,
    );

    if (!fs.existsSync(filePath)) {
      res.status(404).send('Not found');
      return;
    }

    res.sendFile(filePath);
  },
);

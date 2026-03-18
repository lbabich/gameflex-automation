import { Router } from 'express';
import { addGame, readGames, updateGame } from '../../lib/games';
import * as stepCache from '../../lib/step-cache';
import type { DeviceType, PlayMode } from '../../lib/types';
import { DEVICE_TYPES, PLAY_MODE, PLAY_MODES } from '../../lib/types';

export const gamesRouter = Router();

gamesRouter.get('/', (_req, res) => {
  const games = readGames();
  const deviceCache = stepCache.getCachedDeviceMap();

  res.json(
    games.map((g) => {
      const cache = deviceCache.get(g.id) ?? { desktop: false, mobile: false };

      return { ...g, desktopCached: cache.desktop, mobileCached: cache.mobile };
    }),
  );
});

gamesRouter.post('/', (req, res) => {
  const { desktopGameId, mobileGameId, name } = req.body as {
    desktopGameId?: unknown;
    mobileGameId?: unknown;
    name?: unknown;
  };

  if (typeof desktopGameId !== 'string' || typeof name !== 'string') {
    res.status(400).json({ error: 'desktopGameId and name are required strings' });
    return;
  }

  if (mobileGameId !== undefined && typeof mobileGameId !== 'string') {
    res.status(400).json({ error: 'mobileGameId must be a string' });
    return;
  }

  try {
    addGame({
      desktopGameId,
      mobileGameId: mobileGameId as string | undefined,
      name,
      desktopEnabled: true,
      desktopPlaymode: PLAY_MODE.DEMO,
      mobileEnabled: false,
      mobilePlaymode: PLAY_MODE.DEMO,
    });
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
    return;
  }

  res.status(201).json({ desktopGameId });
});

gamesRouter.patch('/:id', (req, res) => {
  const { id } = req.params;
  const {
    name,
    desktopGameId,
    mobileGameId,
    desktopEnabled,
    desktopPlaymode,
    mobileEnabled,
    mobilePlaymode,
  } = req.body as {
    name?: unknown;
    desktopGameId?: unknown;
    mobileGameId?: unknown;
    desktopEnabled?: unknown;
    desktopPlaymode?: unknown;
    mobileEnabled?: unknown;
    mobilePlaymode?: unknown;
  };

  if (name !== undefined && typeof name !== 'string') {
    res.status(400).json({ error: 'name must be a string' });
    return;
  }

  if (desktopGameId !== undefined && typeof desktopGameId !== 'string') {
    res.status(400).json({ error: 'desktopGameId must be a string' });
    return;
  }

  if (mobileGameId !== undefined && typeof mobileGameId !== 'string') {
    res.status(400).json({ error: 'mobileGameId must be a string' });
    return;
  }

  if (desktopEnabled !== undefined && typeof desktopEnabled !== 'boolean') {
    res.status(400).json({ error: 'desktopEnabled must be a boolean' });
    return;
  }

  if (desktopPlaymode !== undefined && !PLAY_MODES.includes(desktopPlaymode as PlayMode)) {
    res.status(400).json({ error: 'desktopPlaymode must be demo or real' });
    return;
  }

  if (mobileEnabled !== undefined && typeof mobileEnabled !== 'boolean') {
    res.status(400).json({ error: 'mobileEnabled must be a boolean' });
    return;
  }

  if (mobilePlaymode !== undefined && !PLAY_MODES.includes(mobilePlaymode as PlayMode)) {
    res.status(400).json({ error: 'mobilePlaymode must be demo or real' });
    return;
  }

  try {
    updateGame(id, {
      name: name as string | undefined,
      desktopGameId: desktopGameId as string | undefined,
      mobileGameId: mobileGameId as string | undefined,
      desktopEnabled: desktopEnabled as boolean | undefined,
      desktopPlaymode: desktopPlaymode as PlayMode | undefined,
      mobileEnabled: mobileEnabled as boolean | undefined,
      mobilePlaymode: mobilePlaymode as PlayMode | undefined,
    });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('not found') ? 404 : 400;

    res.status(status).json({ error: msg });
    return;
  }

  res.sendStatus(204);
});

gamesRouter.delete('/:id/steps', (req, res) => {
  const { id } = req.params;

  stepCache.clearAllSteps(id);

  res.sendStatus(204);
});

gamesRouter.delete('/:id/steps/:channel', (req, res) => {
  const { id, channel } = req.params;

  if (!DEVICE_TYPES.includes(channel as DeviceType)) {
    res.status(400).json({ error: 'channel must be desktop or mobile' });
    return;
  }

  stepCache.clearChannelSteps(id, channel as DeviceType);

  res.sendStatus(204);
});

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PlayMode } from './types';

export type GameEntry = {
  id: string;
  desktopGameId: string;
  mobileGameId?: string;
  name: string;
  desktopEnabled: boolean;
  desktopPlaymode: PlayMode;
  mobileEnabled: boolean;
  mobilePlaymode: PlayMode;
};

const GAMES_PATH = path.resolve('src', 'data', 'games.json');

export function readGames(): GameEntry[] {
  let raw: unknown[];

  try {
    raw = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as unknown[];
  } catch {
    return [];
  }

  let dirty = false;

  const games = raw.map((entry) => {
    const g = entry as Record<string, unknown>;

    if (!g.id) {
      g.id = crypto.randomUUID();
      dirty = true;
    }

    const hasLegacyFields = 'channel' in g || 'playmode' in g;

    if (hasLegacyFields) {
      const channel = g.channel as string | undefined;
      const playmode = (g.playmode as PlayMode | undefined) ?? 'demo';

      g.desktopEnabled = channel !== 'mobile';
      g.mobileEnabled = channel === 'mobile' || channel === 'both';
      g.desktopPlaymode = playmode;
      g.mobilePlaymode = playmode;

      delete g.channel;
      delete g.playmode;
      dirty = true;
    }

    if (g.desktopEnabled === undefined) {
      g.desktopEnabled = true;
      dirty = true;
    }

    if (!g.desktopPlaymode) {
      g.desktopPlaymode = 'demo';
      dirty = true;
    }

    if (g.mobileEnabled === undefined) {
      g.mobileEnabled = false;
      dirty = true;
    }

    if (!g.mobilePlaymode) {
      g.mobilePlaymode = 'demo';
      dirty = true;
    }

    return g as unknown as GameEntry;
  });

  if (dirty) {
    fs.mkdirSync(path.dirname(GAMES_PATH), { recursive: true });
    fs.writeFileSync(GAMES_PATH, JSON.stringify(games, null, 2));
  }

  return games;
}

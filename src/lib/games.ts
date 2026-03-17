import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type PlayMode = 'demo' | 'real';

export type Channel = 'desktop' | 'mobile' | 'both';

export type GameEntry = {
  id: string;
  desktopGameId: string;
  mobileGameId?: string;
  name: string;
  playmode: PlayMode;
  channel: Channel;
};

const GAMES_PATH = path.resolve('src', 'data', 'games.json');

export function readGames(): GameEntry[] {
  let games: GameEntry[];

  try {
    games = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as GameEntry[];
  } catch {
    return [];
  }

  let dirty = false;

  for (const g of games) {
    if (!g.id) {
      g.id = crypto.randomUUID();
      dirty = true;
    }

    if (!g.playmode) {
      g.playmode = 'demo';
      dirty = true;
    }

    if (!g.channel) {
      g.channel = 'both';
      dirty = true;
    }
  }

  if (dirty) {
    fs.mkdirSync(path.dirname(GAMES_PATH), { recursive: true });
    fs.writeFileSync(GAMES_PATH, JSON.stringify(games, null, 2));
  }

  return games;
}

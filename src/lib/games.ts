import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type GameEntry = {
  id: string;
  desktopGameId: string;
  mobileGameId?: string;
  name: string;
  url: string;
  mobileUrl?: string;
};

const GAMES_PATH = path.resolve('src', 'data', 'games.json');

export function readGames(): GameEntry[] {
  let games: GameEntry[];

  try {
    games = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as GameEntry[];
  } catch {
    return [];
  }

  const missing = games.filter((g) => {
    return !g.id;
  });

  if (missing.length > 0) {
    for (const g of missing) {
      g.id = crypto.randomUUID();
    }

    fs.mkdirSync(path.dirname(GAMES_PATH), { recursive: true });
    fs.writeFileSync(GAMES_PATH, JSON.stringify(games, null, 2));
  }

  return games;
}

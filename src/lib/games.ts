import * as fs from 'node:fs';
import * as path from 'node:path';

export type GameEntry = {
  gameId: string;
  name: string;
  url: string;
  mobileUrl?: string;
};

const GAMES_PATH = path.resolve('data', 'games.json');

export function readGames(): GameEntry[] {
  try {
    return JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8')) as GameEntry[];
  } catch {
    return [];
  }
}

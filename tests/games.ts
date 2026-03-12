import * as fs from 'node:fs';
import * as path from 'node:path';

export type GameEntry = {
  gameId: string;
  name: string;
  url: string;
  mobileUrl?: string;
};

export const GAMES: GameEntry[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/games.json'), 'utf8'),
) as GameEntry[];

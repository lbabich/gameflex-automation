import { readGames } from '../lib/games';

export type { GameEntry } from '../lib/games';

export const GAMES = readGames();

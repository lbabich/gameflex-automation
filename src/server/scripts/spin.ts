import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import { type DeviceType, PLAY_MODE, type PlayMode } from '../../shared/types';
import type { GameEntry } from '../lib/games';
import { readGames } from '../lib/games';
import * as spinRunner from '../lib/spin-runner';
import type { InternalTestResult, Viewport } from '../types';

dotenv.config();

const VIEWPORT: Viewport = { width: 1280, height: 720 };

function parseArgs() {
  const args = process.argv.slice(2);

  let runID = '';
  let gameIDs: string[] = [];
  let deviceTypes: DeviceType[] = [];
  let playmode: PlayMode = PLAY_MODE.DEMO;

  for (const arg of args) {
    if (arg.startsWith('--runID=')) {
      runID = arg.slice('--runID='.length);
    } else if (arg.startsWith('--gameIDs=')) {
      gameIDs = arg.slice('--gameIDs='.length).split(',').filter(Boolean) as DeviceType[];
    } else if (arg.startsWith('--deviceTypes=')) {
      deviceTypes = arg.slice('--deviceTypes='.length).split(',').filter(Boolean) as DeviceType[];
    } else if (arg.startsWith('--playmode=')) {
      playmode = arg.slice('--playmode='.length) as PlayMode;
    }
  }

  return { runID, gameIDs, deviceTypes, playmode };
}

async function main() {
  const { runID, gameIDs, deviceTypes, playmode } = parseArgs();

  const allGames = readGames();
  const games = allGames.filter((game: GameEntry) => {
    return gameIDs.includes(game.id);
  });

  const browser = await chromium.launch({ headless: false });

  const results: Partial<Record<DeviceType, InternalTestResult>> = {};
  const errors: string[] = [];

  try {
    for (const game of games) {
      for (const deviceType of deviceTypes) {
        const result = await spinRunner.runGameSpin(
          browser,
          game,
          deviceType,
          VIEWPORT,
          runID,
          playmode,
        );

        results[deviceType] = {
          ...result,
          logs: [...results[deviceType]?.logs || [], ...result.logs]
        };
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  process.stdout.write(JSON.stringify({ results, errors }));
}

main().catch((err: unknown) => {
  console.error('[spin] Fatal error:', err);
  process.exit(1);
});

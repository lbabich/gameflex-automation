import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';

import { readGames } from '../lib/games';
import * as spinRunner from '../lib/spin-runner';
import type { DeviceType, Viewport } from '../lib/types';
import { DEVICE_TYPE } from '../lib/types';
import type { TestResult } from '../server/services/runner/types';

dotenv.config();

const VIEWPORT: Viewport = { width: 1280, height: 720 };

function parseArgs() {
  const args = process.argv.slice(2);

  let gameIDs: string[] = [];
  let deviceTypes: DeviceType[] = [DEVICE_TYPE.DESKTOP, DEVICE_TYPE.MOBILE];

  for (const arg of args) {
    if (arg.startsWith('--gameIDs=')) {
      gameIDs = arg.slice('--gameIDs='.length).split(',').filter(Boolean);
    } else if (arg.startsWith('--deviceTypes=')) {
      deviceTypes = arg.slice('--deviceTypes='.length).split(',').filter(Boolean) as DeviceType[];
    }
  }

  return { gameIDs, deviceTypes };
}

async function main() {
  const { gameIDs, deviceTypes } = parseArgs();

  const allGames = readGames();
  const games = allGames.filter((g) => {
    return gameIDs.includes(g.id);
  });

  const browser = await chromium.launch({ headless: false });

  const results: TestResult[] = [];
  const errors: string[] = [];

  try {
    for (const game of games) {
      for (const deviceType of deviceTypes) {
        const enabled = deviceType === DEVICE_TYPE.MOBILE ? game.mobileEnabled : game.desktopEnabled;

        if (!enabled) {
          continue;
        }

        const result = await spinRunner.runGameSpin(browser, game, deviceType, VIEWPORT);

        results.push(result);
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

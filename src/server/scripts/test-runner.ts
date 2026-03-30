import type { Browser, Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import { type DeviceType, PLAY_MODE, type PlayMode, type TestStep } from '../../shared/types';
import * as discovery from '../lib/discovery';
import type { EventAccumulator } from '../lib/event-accumulator';
import * as eventAccumulator from '../lib/event-accumulator';
import type { GameEntry } from '../lib/games';
import { readGames } from '../lib/games';
import {
  GEL_EVENT,
  POST_SPIN_BUFFER_MS,
  SPIN_END_WAIT_MS,
  SPIN_START_TIMEOUT_MS,
} from '../lib/gel-events';
import * as preLaunch from '../lib/pre-launch';
import * as replay from '../lib/replay';
import * as screenshot from '../lib/screenshot';
import * as stepCache from '../lib/step-cache';
import type { InternalTestResult, Viewport } from '../types';

dotenv.config();

const VIEWPORT: Viewport = { width: 1280, height: 720 };

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
        const result = await runGame(browser, game, deviceType, VIEWPORT, runID, playmode);

        results[deviceType] = {
          ...result,
          logs: [...(results[deviceType]?.logs ?? []), ...result.logs],
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

async function runGame(
  browser: Browser,
  game: GameEntry,
  deviceType: DeviceType,
  viewport: Viewport,
  runID: string,
  playmode: PlayMode,
): Promise<InternalTestResult> {
  const httpCredentials =
    process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS
      ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASS }
      : undefined;

  const context = await browser.newContext({ viewport, httpCredentials });
  const page = await context.newPage();

  const startTime = Date.now();
  const steps: TestStep[] = [];
  const annotations: Record<string, string> = {};
  const accumulator = eventAccumulator.createEventAccumulator(page);

  accumulator.register(GEL_EVENT.SPIN_START);
  accumulator.register(GEL_EVENT.SPIN_END);

  annotations.playmode = playmode;

  let failure: Error | null = null;
  let screenshotPaths: string[] = [];

  try {
    await track(steps, 'Launch game via harness', () => {
      return preLaunch.launch(page, game, deviceType, playmode);
    });

    const gameReady = await discoverOrReplay(page, game, viewport, deviceType, steps, runID);

    if (gameReady) {
      annotations['load-time-ms'] = String(gameReady.loadTimeMs);
      annotations['had-load-progress'] = String(gameReady.hadLoadProgress);
    }

    await awaitSpinCycle(page, runID, deviceType, accumulator, steps);
    await takePostSpinSnapshots(page, runID, deviceType);
  } catch (err) {
    failure = err as Error;
    screenshotPaths = await takeFailureSnapshots(page, runID, deviceType);
  }

  await context.close();

  const duration = Date.now() - startTime;
  const filteredStdout = accumulator.getAll();

  if (failure) {
    return {
      title: `spin: ${game.name}`,
      status: 'failed',
      duration,
      error: failure.message,
      failedStep: steps.find((step: TestStep) => {
        return step.error;
      })?.title,
      logs: filteredStdout,
      steps,
      screenshotPaths,
      annotations,
    };
  }

  return {
    title: `spin: ${game.name}`,
    status: 'passed',
    duration,
    logs: filteredStdout,
    steps,
    annotations,
  };
}

async function awaitSpinCycle(
  page: Page,
  runID: string,
  deviceType: DeviceType,
  accumulator: EventAccumulator,
  steps: TestStep[],
): Promise<void> {
  await track(steps, `Spin start: ${GEL_EVENT.SPIN_START}`, async () => {
    await accumulator.waitFor(GEL_EVENT.SPIN_START, SPIN_START_TIMEOUT_MS);
    await screenshot.snap(page, `${runID}/${deviceType}/spin-start.png`);
  });

  await track(steps, `Spin end: ${GEL_EVENT.SPIN_END}`, () => {
    return accumulator.waitFor(GEL_EVENT.SPIN_END, SPIN_END_WAIT_MS);
  });
}

async function takePostSpinSnapshots(
  page: Page,
  runID: string,
  deviceType: DeviceType,
): Promise<void> {
  await page.waitForTimeout(POST_SPIN_BUFFER_MS);
  await screenshot.snap(page, `${runID}/${deviceType}/final-1.png`);
  await page.waitForTimeout(1_500);
  await screenshot.snap(page, `${runID}/${deviceType}/final-2.png`);
  await page.waitForTimeout(1_500);
  await screenshot.snap(page, `${runID}/${deviceType}/final-3.png`);
}

async function takeFailureSnapshots(
  page: Page,
  runID: string,
  deviceType: DeviceType,
): Promise<string[]> {
  const paths: string[] = [];

  paths.push(await screenshot.snap(page, `${runID}/${deviceType}/failure-1.png`));
  await page.waitForTimeout(3_000);
  paths.push(await screenshot.snap(page, `${runID}/${deviceType}/failure-2.png`));
  await page.waitForTimeout(3_000);
  paths.push(await screenshot.snap(page, `${runID}/${deviceType}/failure-3.png`));

  return paths;
}

async function discoverOrReplay(
  page: Page,
  game: GameEntry,
  viewport: Viewport,
  deviceType: DeviceType,
  steps: TestStep[],
  runID: string,
) {
  const cached = stepCache.getSteps(game.id, deviceType, viewport);

  if (cached) {
    return track(steps, `Replay ${cached.steps.length} cached step(s)`, () => {
      return replay.replaySteps(page, runID, cached.steps, deviceType);
    });
  }

  return track(steps, 'Discover steps', async () => {
    try {
      const result = await discovery.discoverSteps(page, game, viewport, deviceType, runID);

      stepCache.setSteps(game.id, deviceType, viewport, {
        discoveredAt: new Date().toISOString(),
        steps: result.steps,
      });

      return result.gameReady;
    } catch (err) {
      if (err instanceof discovery.DiscoveryError && err.partialSteps.length > 0) {
        stepCache.setSteps(game.id, deviceType, viewport, {
          discoveredAt: new Date().toISOString(),
          steps: err.partialSteps,
          partial: true,
        });
      }

      throw err;
    }
  });
}

async function track<T>(steps: TestStep[], title: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();

    steps.push({ title, duration: Date.now() - start });

    return result;
  } catch (err) {
    steps.push({
      title,
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });

    throw err;
  }
}

main().catch((err: unknown) => {
  console.error('[test-runner] Fatal error:', err);
  process.exit(1);
});

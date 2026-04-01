import type { Browser, Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import { type DeviceType, PLAY_MODE, type PlayMode, type RunHints } from '../../shared/types';
import * as eventAccumulator from '../lib/event-accumulator';
import type { GameEntry } from '../lib/games';
import * as games from '../lib/games';
import * as screenshot from '../lib/screenshot';
import * as stepCache from '../lib/step-cache';
import type { InternalTestResult, Viewport } from '../types';
import * as gameClose from './steps/game-close';
import * as gameLoad from './steps/game-load';
import * as spinCycle from './steps/spin-cycle';
import type { RunState, Step } from './steps/types';

dotenv.config();

type GameRunContext = {
  browser: Browser;
  game: GameEntry;
  deviceType: DeviceType;
  viewport: Viewport;
};

type GameRunOptions = {
  runID: string;
  playmode: PlayMode;
  steps: Step[];
  hints: RunHints;
};

const VIEWPORT: Viewport = { width: 1280, height: 720 };
const POST_RUN_BUFFER_MS = 5_000;

const DEFAULT_STEPS = ['gameLoad', 'spinCycle', 'gameClose'];

const STEP_REGISTRY: Record<string, Step> = {
  gameLoad,
  spinCycle,
  gameClose,
};

async function main() {
  const { runID, gameIDs, deviceTypes, playmode, steps, hints } = parseArgs();

  const resolvedSteps = steps.flatMap((name) => {
    const step = STEP_REGISTRY[name];

    if (!step) {
      console.warn(`[test-runner] Unknown step '${name}' — skipping`);
      return [];
    }

    return [step];
  });

  const allGames = games.readGames();
  const selectedGames = allGames.filter((game: GameEntry) => {
    return gameIDs.includes(game.id);
  });

  const browser = await chromium.launch({ headless: false });

  const results: Partial<Record<DeviceType, InternalTestResult>> = {};
  const errors: string[] = [];

  try {
    for (const game of selectedGames) {
      for (const deviceType of deviceTypes) {
        const result = await runGame(
          { browser, game, deviceType, viewport: VIEWPORT },
          { runID, playmode, steps: resolvedSteps, hints },
        );

        results[deviceType] = {
          ...result,
          logs: [...(results[deviceType]?.logs ?? []), ...result.logs],
        };
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  } finally {
    try {
      await browser.close();
    } catch {
      // browser may have already crashed — don't let this swallow the results
    }
  }

  process.stdout.write(JSON.stringify({ results, errors }));
}

function parseArgs() {
  const args = process.argv.slice(2);

  let runID = '';
  let gameIDs: string[] = [];
  let deviceTypes: DeviceType[] = [];
  let playmode: PlayMode = PLAY_MODE.DEMO;
  let steps: string[] = DEFAULT_STEPS;
  let hints: RunHints = {};

  for (const arg of args) {
    if (arg.startsWith('--runID=')) {
      runID = arg.slice('--runID='.length);
    } else if (arg.startsWith('--gameIDs=')) {
      gameIDs = arg.slice('--gameIDs='.length).split(',').filter(Boolean);
    } else if (arg.startsWith('--deviceTypes=')) {
      deviceTypes = arg.slice('--deviceTypes='.length).split(',').filter(Boolean) as DeviceType[];
    } else if (arg.startsWith('--playmode=')) {
      playmode = arg.slice('--playmode='.length) as PlayMode;
    } else if (arg.startsWith('--steps=')) {
      steps = arg.slice('--steps='.length).split(',').filter(Boolean);
    } else if (arg.startsWith('--hints=')) {
      hints = JSON.parse(
        Buffer.from(arg.slice('--hints='.length), 'base64').toString('utf8'),
      ) as RunHints;
    }
  }

  return { runID, gameIDs, deviceTypes, playmode, steps, hints };
}

async function runGame(context: GameRunContext, run: GameRunOptions): Promise<InternalTestResult> {
  const { browser, game, deviceType, viewport } = context;
  const { runID, playmode, steps, hints } = run;

  const httpCredentials =
    process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS
      ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASS }
      : undefined;

  const browserContext = await browser.newContext({ viewport, httpCredentials });
  const page = await browserContext.newPage();

  const startTime = Date.now();
  const runState: RunState = {
    steps: [],
    metadata: { playmode },
    screenshotPaths: [],
  };

  const accumulator = eventAccumulator.createEventAccumulator(page);

  const ctx = { page, accumulator, game, viewport, deviceType, runID, playmode, runState, hints };

  let failure: Error | null = null;

  try {
    for (const step of steps) {
      for (const descriptor of step.plan) {
        runState.steps.push({
          title: descriptor.title,
          duration: 0,
          status: 'skipped',
          optional: descriptor.optional,
        });
      }
    }

    for (const step of steps) {
      await step.discover(ctx);
      await step.execute(ctx);
    }

    stepCache.saveToCache();
    await takePostRunSnapshots(page, runID, deviceType);
  } catch (err) {
    failure = err as Error;
    runState.screenshotPaths = await takeFailureSnapshots(page, runID, deviceType);
  }

  await browserContext.close();

  const duration = Date.now() - startTime;
  const logs = accumulator.getAll();

  if (failure) {
    return {
      title: `spin: ${game.name}`,
      status: 'failed',
      duration,
      error: failure.message,
      failedStep: runState.steps.find((step) => {
        return step.status === 'failed';
      })?.title,
      logs,
      steps: runState.steps,
      screenshotPaths: runState.screenshotPaths,
      metadata: runState.metadata,
    };
  }

  return {
    title: `spin: ${game.name}`,
    status: 'passed',
    duration,
    logs,
    steps: runState.steps,
    metadata: runState.metadata,
  };
}

async function takePostRunSnapshots(
  page: Page,
  runID: string,
  deviceType: DeviceType,
): Promise<void> {
  await page.waitForTimeout(POST_RUN_BUFFER_MS);
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

main().catch((err: unknown) => {
  console.error('[test-runner] Fatal error:', err);
  process.exit(1);
});

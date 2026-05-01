import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import type { DeviceType, GameEntry, RunHints } from '../../shared/types';
import * as games from '../game-catalog/game-catalog.module';
import type { NodeStepCache } from '../step-cache';
import { createDiskStore, createStepCache } from '../step-cache';
import type { InternalTestResult, Viewport } from '../types';
import * as eventAccumulator from './event-accumulator';
import * as screenshot from './screenshot';
import * as audioToggle from './steps/audio-toggle';
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
  steps: Step[];
  hints: RunHints;
  cache: NodeStepCache;
};

const VIEWPORT: Viewport = { width: 1280, height: 720 };
const POST_RUN_BUFFER_MS = 5_000;

const DEFAULT_STEPS = ['gameLoad', 'spinCycle', 'audioToggle', 'gameClose'];

const STEP_REGISTRY: Record<string, Step> = {
  gameLoad,
  spinCycle,
  audioToggle,
  gameClose,
};

async function main() {
  const { runID, gameIDs, deviceTypes, steps, hints, outputFile } = parseArgs();
  const cache = createStepCache(createDiskStore());

  const resolvedSteps = steps.map((name) => {
    const step = STEP_REGISTRY[name];

    if (!step) {
      throw new Error(`Unknown step '${name}'`);
    }

    return step;
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
          { runID, steps: resolvedSteps, hints, cache },
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

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify({ results, errors }));
}

function parseArgs() {
  const args = process.argv.slice(2);

  let runID = '';
  let gameIDs: string[] = [];
  let deviceTypes: DeviceType[] = [];
  let steps = DEFAULT_STEPS;
  let hints: RunHints = {};
  let outputFile = '';

  for (const arg of args) {
    if (arg.startsWith('--runID=')) {
      runID = arg.slice('--runID='.length);
    } else if (arg.startsWith('--gameIDs=')) {
      gameIDs = arg.slice('--gameIDs='.length).split(',').filter(Boolean);
    } else if (arg.startsWith('--deviceTypes=')) {
      deviceTypes = arg.slice('--deviceTypes='.length).split(',').filter(Boolean) as DeviceType[];
    } else if (arg.startsWith('--steps=')) {
      steps = arg.slice('--steps='.length).split(',').filter(Boolean);
    } else if (arg.startsWith('--hints=')) {
      hints = JSON.parse(
        Buffer.from(arg.slice('--hints='.length), 'base64').toString('utf8'),
      ) as RunHints;
    } else if (arg.startsWith('--outputFile=')) {
      outputFile = arg.slice('--outputFile='.length);
    }
  }

  return { runID, gameIDs, deviceTypes, steps, hints, outputFile };
}

async function runGame(context: GameRunContext, run: GameRunOptions): Promise<InternalTestResult> {
  const { browser, game, deviceType, viewport } = context;
  const { runID, steps, hints, cache } = run;

  const httpCredentials =
    process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS
      ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASS }
      : undefined;

  const browserContext = await browser.newContext({ viewport, httpCredentials });
  const page = await browserContext.newPage();

  const startTime = Date.now();
  const runState: RunState = {
    steps: [],
    screenshotPaths: [],
  };

  const accumulator = eventAccumulator.createEventAccumulator(page);

  const ctx = { page, accumulator, game, viewport, deviceType, runID, runState, cache, hints };

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
    };
  }

  return {
    title: `spin: ${game.name}`,
    status: 'passed',
    duration,
    logs,
    steps: runState.steps,
  };
}

async function takePostRunSnapshots(page: Page, runID: string, deviceType: DeviceType) {
  await page.waitForTimeout(POST_RUN_BUFFER_MS);
  await screenshot.snap(page, `${runID}/${deviceType}/final-1.png`);
  await page.waitForTimeout(1_500);
  await screenshot.snap(page, `${runID}/${deviceType}/final-2.png`);
  await page.waitForTimeout(1_500);
  await screenshot.snap(page, `${runID}/${deviceType}/final-3.png`);
}

async function takeFailureSnapshots(page: Page, runID: string, deviceType: DeviceType) {
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

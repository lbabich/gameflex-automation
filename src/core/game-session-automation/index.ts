import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import type { DeviceType, GameEntry, RunHints, TestStep } from '../../shared/types';
import type { NodeStepCache } from '../step-cache';
import { createDiskStore, createStepCache } from '../step-cache';
import type { ChildProcessOutput, InternalTestResult, Viewport } from '../types';
import type { EventAccumulator } from './event-accumulator';
import * as eventAccumulator from './event-accumulator';
import * as screenshot from './screenshot';
import * as audioToggle from './steps/audio-toggle';
import * as gameClose from './steps/game-close';
import * as gameLoad from './steps/game-load';
import * as spinCycle from './steps/spin-cycle';
import { StepFailure } from './steps/track';
import type { SessionContext, Step } from './steps/types';

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

type StepOutcome = {
  collectedSteps: TestStep[];
  screenshotPaths: string[];
  failure: Error | null;
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
  const { runID, selectedGames, deviceTypes, steps, hints, outputFile } = parseArgs();
  const cache = createStepCache(createDiskStore());

  const resolvedSteps = steps.map((name) => {
    const step = STEP_REGISTRY[name];

    if (!step) {
      throw new Error(`Unknown step '${name}'`);
    }

    return step;
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

  const output: ChildProcessOutput = { results, errors };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(output));
}

function parseArgs() {
  const args = process.argv.slice(2);

  let runID = '';
  let selectedGames: GameEntry[] = [];
  let deviceTypes: DeviceType[] = [];
  let steps = DEFAULT_STEPS;
  let hints: RunHints = {};
  let outputFile = '';

  for (const arg of args) {
    if (arg.startsWith('--runID=')) {
      runID = arg.slice('--runID='.length);
    } else if (arg.startsWith('--games=')) {
      selectedGames = JSON.parse(
        Buffer.from(arg.slice('--games='.length), 'base64').toString('utf8'),
      ) as GameEntry[];
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

  return { runID, selectedGames, deviceTypes, steps, hints, outputFile };
}

async function runGame(context: GameRunContext, run: GameRunOptions): Promise<InternalTestResult> {
  const { page, browserContext } = await openSession(context.browser, context.viewport);
  const accumulator = eventAccumulator.createEventAccumulator(page);
  const ctx = buildSessionContext(page, accumulator, context, run);
  const plannedSteps = planSteps(run.steps);
  const startTime = Date.now();

  const outcome = await executeSteps(ctx, run.steps);

  await browserContext.close();

  const duration = Date.now() - startTime;
  const logs = accumulator.getAll();
  const allSteps = mergeSteps(plannedSteps, outcome.collectedSteps);

  return buildResult(context.game, duration, logs, allSteps, outcome);
}

async function openSession(
  browser: Browser,
  viewport: Viewport,
): Promise<{ page: Page; browserContext: BrowserContext }> {
  const httpCredentials =
    process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS
      ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASS }
      : undefined;

  const browserContext = await browser.newContext({ viewport, httpCredentials });
  const page = await browserContext.newPage();

  return { page, browserContext };
}

function buildSessionContext(
  page: Page,
  accumulator: EventAccumulator,
  context: GameRunContext,
  run: GameRunOptions,
): SessionContext {
  return {
    page,
    accumulator,
    game: context.game,
    viewport: context.viewport,
    deviceType: context.deviceType,
    runID: run.runID,
    cache: run.cache,
    hints: run.hints,
  };
}

function planSteps(steps: Step[]): TestStep[] {
  return steps.flatMap((step) => {
    return step.plan.map((descriptor) => {
      return {
        title: descriptor.title,
        duration: 0,
        status: 'skipped' as const,
        optional: descriptor.optional,
      };
    });
  });
}

async function executeSteps(ctx: SessionContext, steps: Step[]): Promise<StepOutcome> {
  const collectedSteps: TestStep[] = [];

  try {
    for (const step of steps) {
      await step.discover(ctx);

      const stepSteps = await step.execute(ctx);

      collectedSteps.push(...stepSteps);
    }

    await takePostRunSnapshots(ctx.page, ctx.runID, ctx.deviceType);

    return { collectedSteps, screenshotPaths: [], failure: null };
  } catch (err) {
    const failure = err as Error;

    if (err instanceof StepFailure) {
      collectedSteps.push(err.step);
    }

    const screenshotPaths = await takeFailureSnapshots(ctx.page, ctx.runID, ctx.deviceType);

    return { collectedSteps, screenshotPaths, failure };
  }
}

function buildResult(
  game: GameEntry,
  duration: number,
  logs: string[],
  allSteps: TestStep[],
  outcome: StepOutcome,
): InternalTestResult {
  const title = `spin: ${game.name}`;

  if (outcome.failure) {
    return {
      title,
      status: 'failed',
      duration,
      error: outcome.failure.message,
      failedStep: allSteps.find((step) => {
        return step.status === 'failed';
      })?.title,
      logs,
      steps: allSteps,
      screenshotPaths: outcome.screenshotPaths,
    };
  }

  return {
    title,
    status: 'passed',
    duration,
    logs,
    steps: allSteps,
  };
}

function mergeSteps(planned: TestStep[], actual: TestStep[]): TestStep[] {
  const result = [...planned];

  for (const step of actual) {
    const planTitle = step.title.replace(' (cached)', '');
    const idx = result.findIndex((s) => {
      return s.title === planTitle;
    });

    if (idx >= 0) {
      result[idx] = step;
    } else {
      result.push(step);
    }
  }

  return result;
}

async function takePostRunSnapshots(page: Page, runID: string, deviceType: DeviceType) {
  await snapSequence(page, `${runID}/${deviceType}`, 'final', {
    initialWaitMs: POST_RUN_BUFFER_MS,
    betweenWaitMs: 1_500,
  });
}

async function takeFailureSnapshots(page: Page, runID: string, deviceType: DeviceType) {
  return snapSequence(page, `${runID}/${deviceType}`, 'failure', { betweenWaitMs: 3_000 });
}

async function snapSequence(
  page: Page,
  dir: string,
  prefix: string,
  options: { initialWaitMs?: number; betweenWaitMs: number },
): Promise<string[]> {
  const paths: string[] = [];

  if (options.initialWaitMs) {
    await page.waitForTimeout(options.initialWaitMs);
  }

  paths.push(await screenshot.snap(page, `${dir}/${prefix}-1.png`));
  await page.waitForTimeout(options.betweenWaitMs);
  paths.push(await screenshot.snap(page, `${dir}/${prefix}-2.png`));
  await page.waitForTimeout(options.betweenWaitMs);
  paths.push(await screenshot.snap(page, `${dir}/${prefix}-3.png`));

  return paths;
}

main().catch((err: unknown) => {
  console.error('[test-runner] Fatal error:', err);
  process.exit(1);
});

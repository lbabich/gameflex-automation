import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { DeviceType, GameEntry, RunHints, TestStep } from '../../shared/types';
import type { NodeStepCache } from '../step-cache/cache';
import type { InternalTestResult, Viewport } from '../types';
import { screenshot } from './capture/screenshot';
import type { EventAccumulator } from './gel/accumulator';
import { accumulator } from './gel/accumulator';
import { replay } from './replay';
import { stepRegistry } from './steps/registry';
import { tracker } from './steps/track';
import type { FullStepContext, Step } from './steps/types';
import type { VisionAnalyzer } from './vision-analyzer';

export type GameSessionContext = {
  browser: Browser;
  game: GameEntry;
  deviceType: DeviceType;
  viewport: Viewport;
};

export type GameSessionOptions = {
  runID: string;
  steps: Step<FullStepContext>[];
  hints: RunHints;
  cache: NodeStepCache;
};

type StepOutcome = {
  collectedSteps: TestStep[];
  screenshotPaths: string[];
  failure: Error | null;
};

const POST_RUN_BUFFER_MS = 5_000;

async function run(
  context: GameSessionContext,
  options: GameSessionOptions,
  visionAnalyzer: VisionAnalyzer,
): Promise<InternalTestResult> {
  const { page, browserContext } = await openSession(context.browser, context.viewport);
  const eventAccumulator = accumulator.createEventAccumulator(page);
  const ctx = buildSessionContext(page, eventAccumulator, context, options, visionAnalyzer);
  const plannedSteps = stepRegistry.planSteps(options.steps);
  const startTime = Date.now();

  const outcome = await executeSteps(ctx, options.steps);

  await browserContext.close();

  const duration = Date.now() - startTime;
  const logs = eventAccumulator.getAll();
  const allSteps = stepRegistry.mergeSteps(plannedSteps, outcome.collectedSteps);

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
  eventAccumulator: EventAccumulator,
  context: GameSessionContext,
  options: GameSessionOptions,
  visionAnalyzer: VisionAnalyzer,
): FullStepContext {
  return {
    page,
    accumulator: eventAccumulator,
    game: context.game,
    viewport: context.viewport,
    deviceType: context.deviceType,
    runID: options.runID,
    cache: options.cache,
    hints: options.hints,
    visionAnalyzer,
  };
}

async function executeSteps(
  ctx: FullStepContext,
  steps: Step<FullStepContext>[],
): Promise<StepOutcome> {
  const collectedSteps: TestStep[] = [];

  try {
    for (const step of steps) {
      await step.discover(ctx);

      const cached = ctx.cache.getSteps({
        id: ctx.game.id,
        deviceType: ctx.deviceType,
        viewport: ctx.viewport,
        stepName: step.stepName,
      });

      if (cached) {
        await replay.replaySteps(ctx.page, ctx.runID, cached.steps, ctx.deviceType);
      }

      const stepSteps = await step.run(ctx, cached?.steps ?? null);

      collectedSteps.push(...stepSteps);
    }

    await takePostRunSnapshots(ctx.page, ctx.runID, ctx.deviceType);

    return { collectedSteps, screenshotPaths: [], failure: null };
  } catch (err) {
    const failure = err as Error;

    if (err instanceof tracker.StepFailure) {
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

export const gameSession = { run };

import type { Browser, ConsoleMessage, Page } from '@playwright/test';
import type { TestResult, TestStep } from '../services/runner/types';
import * as discovery from './discovery';
import type { GameEntry } from './games';
import {
  GEL_EVENT,
  POST_SPIN_BUFFER_MS,
  SPIN_END_WAIT_MS,
  SPIN_START_TIMEOUT_MS,
} from './gel-events';
import * as preLaunch from './pre-launch';
import * as replay from './replay';
import * as screenshot from './screenshot';
import * as stepCache from './step-cache';
import type { DeviceType, PlayMode, Viewport } from './types';

export type SpinRunnerModule = {
  runGameSpin: (
    browser: Browser,
    game: GameEntry,
    deviceType: DeviceType,
    viewport: Viewport,
    runID: string,
    playmode: PlayMode,
  ) => Promise<TestResult>;
};

type SpinListeners = {
  isSpinStart: (msg: ConsoleMessage) => boolean;
  isSpinEnd: (msg: ConsoleMessage) => boolean;
  getSpinStarted: () => boolean;
};

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

function setupSpinListeners(page: Page, stdout: string[]): SpinListeners {
  const isSpinStart = (msg: ConsoleMessage) => {
    return msg.text().includes(GEL_EVENT.SPIN_START);
  };

  const isSpinEnd = (msg: ConsoleMessage) => {
    return msg.text().includes(GEL_EVENT.SPIN_END);
  };

  let spinStarted = false;

  page.on('console', (msg) => {
    stdout.push(msg.text());

    if (isSpinStart(msg)) {
      spinStarted = true;
    }
  });

  return {
    isSpinStart,
    isSpinEnd,
    getSpinStarted: () => {
      return spinStarted;
    },
  };
}

function filterStdout(lines: string[]) {
  return lines
    .map((line: string) => {
      return line.trimEnd();
    })
    .filter((line: string) => {
      return line && !line.startsWith('Screenshot saved:');
    });
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

async function awaitSpinCycle(
  page: Page,
  runID: string,
  deviceType: DeviceType,
  listeners: SpinListeners,
  steps: TestStep[],
): Promise<void> {
  await track(steps, `Spin start: ${GEL_EVENT.SPIN_START}`, async () => {
    if (!listeners.getSpinStarted()) {
      await page.waitForEvent('console', {
        predicate: listeners.isSpinStart,
        timeout: SPIN_START_TIMEOUT_MS,
      });
    }

    await screenshot.snap(page, `${runID}/${deviceType}/spin-start.png`);
  });

  await track(steps, `Spin end: ${GEL_EVENT.SPIN_END}`, () => {
    return page.waitForEvent('console', {
      predicate: listeners.isSpinEnd,
      timeout: SPIN_END_WAIT_MS,
    });
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

async function runGameSpin(
  browser: Browser,
  game: GameEntry,
  deviceType: DeviceType,
  viewport: Viewport,
  runID: string,
  playmode: PlayMode,
): Promise<TestResult> {
  const httpCredentials =
    process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS
      ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASS }
      : undefined;

  const context = await browser.newContext({ viewport, httpCredentials });
  const page = await context.newPage();

  const startTime = Date.now();
  const steps: TestStep[] = [];
  const annotations: Record<string, string> = {};
  const stdout: string[] = [];
  const spinListeners = setupSpinListeners(page, stdout);
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

    await awaitSpinCycle(page, runID, deviceType, spinListeners, steps);
    await takePostSpinSnapshots(page, runID, deviceType);
  } catch (err) {
    failure = err as Error;
    screenshotPaths = await takeFailureSnapshots(page, runID, deviceType);
  }

  await context.close();

  const duration = Date.now() - startTime;
  const filteredStdout = filterStdout(stdout);

  if (failure) {
    return {
      title: `spin: ${game.name}`,
      project: deviceType,
      status: 'failed',
      duration,
      error: failure.message,
      failedStep: steps.find((s: TestStep) => {
        return s.error;
      })?.title,
      stdout: filteredStdout,
      steps,
      screenshotPaths,
      annotations,
    };
  }

  return {
    title: `spin: ${game.name}`,
    project: deviceType,
    status: 'passed',
    duration,
    stdout: filteredStdout,
    steps,
    annotations,
  };
}

export { runGameSpin };

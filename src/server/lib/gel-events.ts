import type { Page } from '@playwright/test';

export const GEL_EVENT = {
  // Optional — absence is recorded as a warning, not a test failure.
  LOAD_PROGRESS: 'gel.load.progress',
  // Required — absence hard-fails the test via SlowLoadError.
  READY: 'gel.ready',
  // Required — absence hard-fails the test via Playwright waitForEvent timeout.
  SPIN_START: 'gel.spin.start',
  // Required — absence hard-fails the test via Playwright waitForEvent timeout.
  SPIN_END: 'gel.spin.end',
  // Required - Test if game close works
  GAME_CLOSE: 'gel.close',
} as const;

export const GEL_READY_TIMEOUT_MS = 10_000;
export const SPIN_START_TIMEOUT_MS = 10_000;
export const SPIN_END_WAIT_MS = 15_000;
export const GAME_CLOSE_TIMEOUT_MS = 10_000;

export type GameReadyResult = {
  loadTimeMs: number;
  hadLoadProgress: boolean;
};

async function waitForGameReady(
  page: Page,
  timeout = GEL_READY_TIMEOUT_MS,
): Promise<GameReadyResult> {
  const startTime = Date.now();

  let hadLoadProgress = false;

  const onLoadProgress = (msg: { text: () => string }) => {
    if (msg.text().startsWith(GEL_EVENT.LOAD_PROGRESS)) {
      hadLoadProgress = true;
    }
  };

  page.on('console', onLoadProgress);

  try {
    await page.waitForEvent('console', {
      predicate: (msg) => {
        return msg.text().includes(GEL_EVENT.READY);
      },
      timeout,
    });

    return {
      loadTimeMs: Date.now() - startTime,
      hadLoadProgress,
    };
  } catch {
    throw new SlowLoadError(Date.now() - startTime);
  } finally {
    page.off('console', onLoadProgress);
  }
}

class SlowLoadError extends Error {
  constructor(elapsedMs: number) {
    super(`Game did not emit gel.ready within ${elapsedMs}ms`);
    this.name = 'SlowLoadError';
  }
}

export { SlowLoadError, waitForGameReady };

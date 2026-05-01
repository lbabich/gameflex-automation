import type { Page } from '@playwright/test';

export const GEL_EVENT = {
  // Optional
  LOAD_PROGRESS: 'gel.load.progress',
  // Required
  READY: 'gel.ready',
  // Required
  SPIN_START: 'gel.spin.start',
  // Required
  SPIN_END: 'gel.spin.end',
  // Required
  GAME_CLOSE: 'gel.close',
  // Optional
  AUDIO_ENABLE: 'gel.audio.enable',
  // Optional
  AUDIO_DISABLE: 'gel.audio.disable',
} as const;

export const GEL_READY_TIMEOUT_MS = 90_000;

export type GameReadyResult = {
  loadTimeMs: number;
  hadLoadProgress: boolean;
};

export async function waitForGameReady(
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

export class SlowLoadError extends Error {
  constructor(elapsedMs: number) {
    super(`Game did not emit gel.ready within ${elapsedMs}ms`);
    this.name = 'SlowLoadError';
  }
}

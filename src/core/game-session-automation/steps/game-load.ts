import type { DeviceType, GameEntry, TestStep } from '../../../shared/types';
import type { CachedStep } from '../../types';
import type { EventAccumulator } from '../gel/accumulator';
import { gelEvents } from '../gel/events';
import { preLaunch } from '../pre-launch';
import { tracker } from './track';
import type { Step, StepDescriptor } from './types';

type GameLoadContext = {
  page: import('@playwright/test').Page;
  game: GameEntry;
  deviceType: DeviceType;
  accumulator: EventAccumulator;
};

const stepName = 'gameLoad';

const plan: StepDescriptor[] = [
  { title: 'Launch game via harness' },
  { title: gelEvents.GEL_EVENT.LOAD_PROGRESS, optional: true },
  { title: gelEvents.GEL_EVENT.READY },
];

async function discover(_ctx: GameLoadContext) {
  console.log('[game-load] No discovery process');
}

async function run(ctx: GameLoadContext, _cachedSteps: CachedStep[] | null) {
  const { page, game, deviceType, accumulator } = ctx;
  const readyPromise = accumulator.waitFor(
    gelEvents.GEL_EVENT.READY,
    gelEvents.GEL_READY_TIMEOUT_MS,
  );

  readyPromise.catch(() => {}); // prevent unhandled rejection if timeout fires during launch

  const launchStep = await tracker.track('Launch game via harness', () => {
    return preLaunch.launch(page, game, deviceType);
  });

  const readyStep = await tracker.track(gelEvents.GEL_EVENT.READY, () => {
    return readyPromise;
  });

  const hadLoadProgress = accumulator.getAll().some((line) => {
    return line.includes(gelEvents.GEL_EVENT.LOAD_PROGRESS);
  });

  const loadProgressStep: TestStep = {
    title: gelEvents.GEL_EVENT.LOAD_PROGRESS,
    duration: 0,
    status: hadLoadProgress ? 'passed' : 'warning',
    optional: true,
  };

  return [launchStep, loadProgressStep, readyStep];
}

export const gameLoad: Step<GameLoadContext> = { stepName, plan, discover, run };

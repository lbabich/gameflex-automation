import type { CachedStep } from '../../types';
import { screenshot } from '../capture/screenshot';
import { discovery } from '../discovery';
import { gelEvents } from '../gel/events';
import { stepUtils } from './step-utils';
import { tracker } from './track';
import type { FullStepContext, Step, StepDescriptor } from './types';

const SPIN_START_WAIT_MS = 15_000;
const SPIN_END_WAIT_MS = 15_000;
const SPIN_VERIFY_TIMEOUT_MS = 3_000;

const stepName = 'spinCycle';

const plan: StepDescriptor[] = [
  { title: `Spin start: ${gelEvents.GEL_EVENT.SPIN_START}` },
  { title: `Spin end: ${gelEvents.GEL_EVENT.SPIN_END}` },
];

const discover = async (ctx: FullStepContext) => {
  await discovery.discoverTarget(ctx, {
    stepName,
    defaultInstructions: ({ width, height }) => {
      return `What is the single most important element to click to either trigger a spin or navigate toward the spin button?\n\nIf the spin button is visible and unobstructed, click it. The spin button is typically the largest circular button on screen — commonly has clockwise-rotating arrows around its edge, a play/triangle icon in the centre, or is labeled SPIN. It must be fully visible and not covered by any overlay.\n\nIf the spin button is not accessible, click whatever would unblock it: a dialog button (Continue, OK, Accept, Yes, No), close X, age/terms prompt, overlay, promo/bonus intro screen, or a full-screen brand logo or game-title splash screen (click the centre of the screen for those).\n\nDo NOT suggest: loading bars, progress indicators, loading spinners, percentage counters, autoplay buttons, or bet/settings controls.\nIf the game is still loading (spinner visible), return {"found": false}.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;
    },
    failureContext: (list) => {
      return `Context: The following buttons were clicked as spin candidates but did not trigger a spin:\n${list}\nFeel free to suggest clicking a Back/Cancel/navigation button or another UI path to reach a different game state where the real spin button may be accessible.`;
    },
    getHint: (hints) => {
      return hints?.spinCycle;
    },
    verifyClick: stepUtils.onGelEvent(gelEvents.GEL_EVENT.SPIN_START, SPIN_VERIFY_TIMEOUT_MS),
    checkComplete: stepUtils.gelCheck(gelEvents.GEL_EVENT.SPIN_START),
  });
};

async function run(ctx: FullStepContext, _cachedSteps: CachedStep[] | null) {
  const { page, accumulator, runID, deviceType } = ctx;
  const spinStartPromise = accumulator.waitFor(gelEvents.GEL_EVENT.SPIN_START, SPIN_START_WAIT_MS);

  const spinStartStep = await tracker.track(
    `Spin start: ${gelEvents.GEL_EVENT.SPIN_START}`,
    async () => {
      await spinStartPromise;
      await screenshot.snap(page, `${runID}/${deviceType}/spin-start.png`);
    },
  );

  const spinEndPromise = accumulator.waitFor(gelEvents.GEL_EVENT.SPIN_END, SPIN_END_WAIT_MS);

  const spinEndStep = await tracker.track(`Spin end: ${gelEvents.GEL_EVENT.SPIN_END}`, () => {
    return spinEndPromise;
  });

  return [spinStartStep, spinEndStep];
}

export const spinCycle: Step<FullStepContext> = { stepName, plan, discover, run };

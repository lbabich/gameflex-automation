import { GEL_EVENT } from '../gel-events';
import * as replay from '../replay';
import * as screenshot from '../screenshot';
import { makeDiscover, onGelEvent } from './make-discover';
import { track } from './track';
import type { SessionContext, StepDescriptor } from './types';

export const plan: StepDescriptor[] = [
  { title: `Spin start: ${GEL_EVENT.SPIN_START}` },
  { title: `Spin end: ${GEL_EVENT.SPIN_END}` },
];

const STEP_NAME = 'spinCycle';
const SPIN_START_WAIT_MS = 15_000;
const SPIN_END_WAIT_MS = 15_000;
const SPIN_VERIFY_TIMEOUT_MS = 3_000;

export const discover = makeDiscover({
  stepName: STEP_NAME,
  defaultInstructions: ({ width, height }) => {
    return `What is the single most important element to click to either trigger a spin or navigate toward the spin button?\n\nIf the spin button is visible and unobstructed, click it. The spin button is typically the largest circular button on screen — commonly has clockwise-rotating arrows around its edge, a play/triangle icon in the centre, or is labeled SPIN. It must be fully visible and not covered by any overlay.\n\nIf the spin button is not accessible, click whatever would unblock it: a dialog button (Continue, OK, Accept, Yes, No), close X, age/terms prompt, overlay, promo/bonus intro screen, or a full-screen brand logo or game-title splash screen (click the centre of the screen for those).\n\nDo NOT suggest: loading bars, progress indicators, loading spinners, percentage counters, autoplay buttons, or bet/settings controls.\nIf the game is still loading (spinner visible), return {"found": false}.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;
  },
  failureContext: (list) => {
    return `Context: The following buttons were clicked as spin candidates but did not trigger a spin:\n${list}\nFeel free to suggest clicking a Back/Cancel/navigation button or another UI path to reach a different game state where the real spin button may be accessible.`;
  },
  getHint: (hints) => {
    return hints?.spinCycle;
  },
  verifyClick: onGelEvent(GEL_EVENT.SPIN_START, SPIN_VERIFY_TIMEOUT_MS),
  checkComplete: onGelEvent(GEL_EVENT.SPIN_START, 0),
});

export async function execute(ctx: SessionContext) {
  const { page, accumulator, game, viewport, runID, deviceType, cache } = ctx;
  const cached = cache.getSteps({ id: game.id, deviceType, viewport, stepName: STEP_NAME });

  if (cached) {
    await replay.replaySteps(page, runID, cached.steps, deviceType);
  }

  const spinStartPromise = accumulator.waitFor(GEL_EVENT.SPIN_START, SPIN_START_WAIT_MS);
  const suffix = cached ? ' (cached)' : '';

  const spinStartStep = await track(`Spin start: ${GEL_EVENT.SPIN_START}${suffix}`, async () => {
    await spinStartPromise;
    await screenshot.snap(page, `${runID}/${deviceType}/spin-start.png`);
  });

  const spinEndPromise = accumulator.waitFor(GEL_EVENT.SPIN_END, SPIN_END_WAIT_MS);

  const spinEndStep = await track(`Spin end: ${GEL_EVENT.SPIN_END}${suffix}`, () => {
    return spinEndPromise;
  });

  return [spinStartStep, spinEndStep];
}

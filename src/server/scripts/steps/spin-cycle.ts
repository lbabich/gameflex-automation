import { GEL_EVENT } from '../../lib/gel-events';
import * as replay from '../../lib/replay';
import * as screenshot from '../../lib/screenshot';
import * as stepCache from '../../lib/step-cache';
import type { Viewport } from '../../types';
import type { FailedButton } from './discovery-loop';
import * as discoveryLoop from './discovery-loop';
import { track } from './track';
import type { StepContext } from './types';

const STEP_NAME = 'spinCycle';
const SPIN_START_WAIT_MS = 15_000;
const SPIN_END_WAIT_MS = 15_000;

async function discover(ctx: StepContext): Promise<void> {
  const { page, game, viewport, deviceType, runID } = ctx;

  if (stepCache.getSteps(game.id, deviceType, viewport, STEP_NAME)) {
    return;
  }

  return discoveryLoop.runDiscoveryLoop(
    page,
    game,
    viewport,
    deviceType,
    runID,
    STEP_NAME,
    buildSpinButtonPrompt,
    buildNextClickPrompt,
  );
}

async function execute(ctx: StepContext): Promise<void> {
  const { page, accumulator, game, viewport, runID, deviceType, runState } = ctx;
  const cached = stepCache.getSteps(game.id, deviceType, viewport, STEP_NAME);

  if (cached) {
    await replay.replaySteps(page, runID, cached.steps, deviceType);
  }

  const suffix = cached ? ' (cached)' : '';

  await track(runState.steps, `Spin start: ${GEL_EVENT.SPIN_START}${suffix}`, async () => {
    await accumulator.waitFor(GEL_EVENT.SPIN_START, SPIN_START_WAIT_MS);
    await screenshot.snap(page, `${runID}/${deviceType}/spin-start.png`);
  });

  await track(runState.steps, `Spin end: ${GEL_EVENT.SPIN_END}${suffix}`, () => {
    return accumulator.waitFor(GEL_EVENT.SPIN_END, SPIN_END_WAIT_MS);
  });
}

function buildSpinButtonPrompt(viewport: Viewport, failedButtons: FailedButton[]): string {
  const { width, height } = viewport;

  let prompt = `Is the main spin button visible and unobstructed in this screenshot? It is typically the most prominent interactive element on screen — generally the largest circular button visible. It is most commonly a large circular button with clockwise-rotating arrow or arrows around its edge (like a circular refresh/rotate icon), or a play/triangle icon in the centre, or labeled SPIN. It must be fully visible.\n\nRespond with exactly one of:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;

  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((button: FailedButton) => {
        return `- "${button.label}" at (${button.x}, ${button.y})`;
      })
      .join('\n');

    prompt += `\n\nPreviously clicked buttons that looked like spin buttons but did NOT trigger a real spin (do NOT click these):\n${list}\nLook for a DIFFERENT spin trigger. If no other candidate exists, return {"found": false} — it is better to say not found than to repeat a known failure.`;
  }

  return prompt;
}

function buildNextClickPrompt(viewport: Viewport, failedButtons: FailedButton[]): string {
  const { width, height } = viewport;

  let prompt = `The spin button is not yet accessible. What is the single most important element to click to progress — a dialog button (Continue, OK, Accept, Yes, No), close X, age/terms prompt, overlay, or promo/bonus intro screen? Also includes full-screen brand logo or game-title splash screens with no spin UI visible — if you see one, return the centre of the screen as the click target. If the screen appears fully interactive with no blockers and no splash (spin button may still be loading), return {"found": false}.\n\nDo NOT suggest clicking loading bars, progress indicators, loading spinners, or percentage counters — these are not interactive elements. If the game is still loading (spinner visible, assets loading), return {"found": false}.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;

  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((button: FailedButton) => {
        return `- "${button.label}" at (${button.x}, ${button.y})`;
      })
      .join('\n');

    prompt += `\n\nContext: The following buttons were clicked as spin candidates but did not trigger a spin:\n${list}\nFeel free to suggest clicking a Back/Cancel/navigation button or another UI path to reach a different game state where the real spin button may be accessible.`;
  }

  return prompt;
}

export { discover, execute };

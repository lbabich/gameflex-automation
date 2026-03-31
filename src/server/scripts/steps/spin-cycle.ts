import { GEL_EVENT } from '../../lib/gel-events';
import * as replay from '../../lib/replay';
import * as screenshot from '../../lib/screenshot';
import * as stepCache from '../../lib/step-cache';
import type { Viewport } from '../../types';
import type { FailedButton } from './discovery-loop';
import * as discoveryLoop from './discovery-loop';
import { track } from './track';
import type { StepContext, StepDescriptor } from './types';

const plan: StepDescriptor[] = [
  { title: `Spin start: ${GEL_EVENT.SPIN_START}` },
  { title: `Spin end: ${GEL_EVENT.SPIN_END}` },
];

const STEP_NAME = 'spinCycle';
const SPIN_START_WAIT_MS = 15_000;
const SPIN_END_WAIT_MS = 15_000;
const SPIN_VERIFY_TIMEOUT_MS = 3_000;

async function discover(ctx: StepContext): Promise<void> {
  const { page, game, viewport, deviceType, runID, accumulator, hints } = ctx;

  if (stepCache.getSteps(game.id, deviceType, viewport, STEP_NAME)) {
    return;
  }

  const verifySpinClick = () => {
    return accumulator
      .waitFor(GEL_EVENT.SPIN_START, SPIN_VERIFY_TIMEOUT_MS)
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  };

  const hint = hints?.spinCycle;
  const promptBuilder = (v: Viewport, f: FailedButton[]) => {
    return buildNextClickPrompt(hint, v, f);
  };

  return discoveryLoop.runDiscoveryLoop(
    page,
    game,
    viewport,
    deviceType,
    runID,
    STEP_NAME,
    promptBuilder,
    verifySpinClick,
  );
}

async function execute(ctx: StepContext): Promise<void> {
  const { page, accumulator, game, viewport, runID, deviceType, runState } = ctx;
  const cached = stepCache.getSteps(game.id, deviceType, viewport, STEP_NAME);

  if (cached) {
    await replay.replaySteps(page, runID, cached.steps, deviceType);
  }

  const spinStartPromise = accumulator.waitFor(GEL_EVENT.SPIN_START, SPIN_START_WAIT_MS);
  const suffix = cached ? ' (cached)' : '';

  await track(runState.steps, `Spin start: ${GEL_EVENT.SPIN_START}${suffix}`, async () => {
    await spinStartPromise;
    await screenshot.snap(page, `${runID}/${deviceType}/spin-start.png`);
  });

  const spinEndPromise = accumulator.waitFor(GEL_EVENT.SPIN_END, SPIN_END_WAIT_MS);

  await track(runState.steps, `Spin end: ${GEL_EVENT.SPIN_END}${suffix}`, () => {
    return spinEndPromise;
  });
}

function buildNextClickPrompt(
  hint: string | undefined,
  viewport: Viewport,
  failedButtons: FailedButton[],
): string {
  const { width, height } = viewport;

  if (hint) {
    const stepNumber = failedButtons.length + 1;

    const completedSection =
      failedButtons.length === 0
        ? 'None — this is step 1.'
        : failedButtons
            .map((button: FailedButton, i: number) => {
              return `  Step ${i + 1}: "${button.label}" at (${button.x}, ${button.y})`;
            })
            .join('\n');

    return `You are clicking through a multi-step UI sequence for a casino game.

OPERATOR SEQUENCE:
${hint}

COMPLETED STEPS (${failedButtons.length} done):
${completedSection}

YOUR TASK: Click the element for step ${stepNumber} of the operator sequence above.

RULES:
- Follow the operator sequence only — do not use your own judgment about what to click
- Do NOT click the spin button unless the operator sequence explicitly calls for it at step ${stepNumber}
- Do NOT skip ahead even if later targets in the sequence are visible on screen
- Re-clicking a button from an earlier step is correct and expected if the sequence calls for it

Respond with:
  {"found": false}
  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}

Image dimensions: ${width}x${height}`;
  }

  let prompt = `What is the single most important element to click to either trigger a spin or navigate toward the spin button?\n\nIf the spin button is visible and unobstructed, click it. The spin button is typically the largest circular button on screen — commonly has clockwise-rotating arrows around its edge, a play/triangle icon in the centre, or is labeled SPIN. It must be fully visible and not covered by any overlay.\n\nIf the spin button is not accessible, click whatever would unblock it: a dialog button (Continue, OK, Accept, Yes, No), close X, age/terms prompt, overlay, promo/bonus intro screen, or a full-screen brand logo or game-title splash screen (click the centre of the screen for those).\n\nDo NOT suggest: loading bars, progress indicators, loading spinners, percentage counters, autoplay buttons, or bet/settings controls.\nIf the game is still loading (spinner visible), return {"found": false}.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;

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

export { discover, execute, plan };

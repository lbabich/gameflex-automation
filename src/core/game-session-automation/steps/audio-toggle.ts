import { stepCache } from '../../step-cache';
import type { Viewport } from '../../types';
import type { FailedButton } from '../discovery/prompt';
import * as discoveryPrompt from '../discovery/prompt';
import { GEL_EVENT } from '../gel-events';
import * as replay from '../replay';
import * as screenshot from '../screenshot';
import { makeDiscover } from './make-discover';
import { track } from './track';
import type { StepContext, StepDescriptor } from './types';

const STEP_NAME = 'audioToggle';
const PLAN_TITLE = `Audio toggle: ${GEL_EVENT.AUDIO_ENABLE} / ${GEL_EVENT.AUDIO_DISABLE}`;
const AUDIO_TOGGLE_WAIT_MS = 10_000;
const AUDIO_VERIFY_TIMEOUT_MS = 3_000;

const plan: StepDescriptor[] = [{ title: PLAN_TITLE, optional: true }];

const discover = makeDiscover({
  stepName: STEP_NAME,
  buildPrompt: buildNextClickPrompt,
  getHint: (hints) => {
    return hints?.audioToggle;
  },
  getVerifyClick: (ctx) => {
    return async (page, x, y) => {
      const enablePromise = ctx.accumulator.waitFor(
        GEL_EVENT.AUDIO_ENABLE,
        AUDIO_VERIFY_TIMEOUT_MS,
      );
      const disablePromise = ctx.accumulator.waitFor(
        GEL_EVENT.AUDIO_DISABLE,
        AUDIO_VERIFY_TIMEOUT_MS,
      );

      await page.mouse.click(x, y);

      return Promise.all([enablePromise, disablePromise])
        .then(() => {
          return true;
        })
        .catch(() => {
          return false;
        });
    };
  },
  savePartialOnFailure: false,
  swallowDiscoveryError: true,
});

async function execute(ctx: StepContext): Promise<void> {
  const { page, accumulator, game, viewport, runID, deviceType, runState } = ctx;

  const cached = stepCache.getSteps({ id: game.id, deviceType, viewport, stepName: STEP_NAME });
  const audioButton = cached?.steps.at(-1);

  if (cached) {
    await replay.replaySteps(page, runID, cached.steps, deviceType);
  }

  const suffix = cached ? ' (cached)' : '';

  await track(runState.steps, `${PLAN_TITLE}${suffix}`, async () => {
    const enablePromise = accumulator.waitFor(GEL_EVENT.AUDIO_ENABLE, AUDIO_TOGGLE_WAIT_MS);
    const disablePromise = accumulator.waitFor(GEL_EVENT.AUDIO_DISABLE, AUDIO_TOGGLE_WAIT_MS);

    if (audioButton) {
      await page.mouse.click(audioButton.x, audioButton.y);
    }

    await Promise.all([enablePromise, disablePromise]);
    await screenshot.snap(page, `${runID}/${deviceType}/audio-toggle.png`);
  });
}

function buildNextClickPrompt(
  hint: string | undefined,
  viewport: Viewport,
  failedButtons: FailedButton[],
): string {
  const { width, height } = viewport;

  const defaultInstructions = `What is the single most important element to click to toggle the game's audio on or off?\n\nCRITICAL EXCLUSION — NEVER click anything in the top ${Math.round(height * 0.08)}px strip of the screen (y < ${Math.round(height * 0.08)}). That strip is the harness navigation bar, not part of the game. This includes any icon, button, or control positioned there. Clicking it will break the test.\n\nLook for targets in this order:\n1. A speaker icon, audio/sound toggle, or mute/unmute control that is part of the game's own UI — rendered inside the game frame (y >= ${Math.round(height * 0.08)}). Click it immediately — this is always the highest priority.\n2. A sound or audio settings button inside the game UI that leads to audio controls.\n3. A hamburger menu (≡) or settings icon — only if no direct audio control is visible.\n4. A back arrow (←) to close an overlay or sub-menu blocking access to audio controls.\n\nDo NOT suggest: spin buttons, bet controls, autoplay buttons, win displays, loading bars, progress indicators, or anything in the harness navigation bar.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;

  return discoveryPrompt.buildDiscoveryPrompt(
    defaultInstructions,
    (list) => {
      return `Previously clicked buttons that did NOT result in an audio toggle event — try a different approach:\n${list}`;
    },
    hint,
    failedButtons,
  );
}

export { discover, execute, plan };

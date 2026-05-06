import type { CachedStep } from '../../types';
import { screenshot } from '../capture/screenshot';
import { discovery } from '../discovery';
import { gelEvents } from '../gel/events';
import { tracker } from './track';
import type { FullStepContext, Step, StepDescriptor } from './types';

const AUDIO_TOGGLE_WAIT_MS = 10_000;
const AUDIO_VERIFY_TIMEOUT_MS = 3_000;

const stepName = 'audioToggle';
const PLAN_TITLE = `Audio toggle: ${gelEvents.GEL_EVENT.AUDIO_ENABLE} / ${gelEvents.GEL_EVENT.AUDIO_DISABLE}`;

const plan: StepDescriptor[] = [{ title: PLAN_TITLE, optional: true }];

const discover = async (ctx: FullStepContext) => {
  try {
    await discovery.discoverTarget(ctx, {
      stepName,
      hintKey: 'audioToggle',
      instructions: ({ width, height }) => {
        return `What is the single most important element to click to toggle the game's audio on or off?\n\nCRITICAL EXCLUSION — NEVER click anything in the top ${Math.round(height * 0.08)}px strip of the screen (y < ${Math.round(height * 0.08)}). That strip is the harness navigation bar, not part of the game. This includes any icon, button, or control positioned there. Clicking it will break the test.\n\nLook for targets in this order:\n1. A speaker icon, audio/sound toggle, or mute/unmute control that is part of the game's own UI — rendered inside the game frame (y >= ${Math.round(height * 0.08)}). Click it immediately — this is always the highest priority.\n2. A sound or audio settings button inside the game UI that leads to audio controls.\n3. A hamburger menu (≡) or settings icon — only if no direct audio control is visible.\n4. A back arrow (←) to close an overlay or sub-menu blocking access to audio controls.\n\nDo NOT suggest: spin buttons, bet controls, autoplay buttons, win displays, loading bars, progress indicators, or anything in the harness navigation bar.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;
      },
      failureInstructions: `Previously clicked buttons that did NOT result in an audio toggle event — try a different approach:\n{failedList}`,
      customVerify: async (verifyCtx, x, y) => {
        const enablePromise = verifyCtx.accumulator.waitFor(
          gelEvents.GEL_EVENT.AUDIO_ENABLE,
          AUDIO_VERIFY_TIMEOUT_MS,
        );
        const disablePromise = verifyCtx.accumulator.waitFor(
          gelEvents.GEL_EVENT.AUDIO_DISABLE,
          AUDIO_VERIFY_TIMEOUT_MS,
        );

        await verifyCtx.page.mouse.click(x, y);

        return Promise.all([enablePromise, disablePromise])
          .then(() => {
            return true;
          })
          .catch(() => {
            return false;
          });
      },
    });
  } catch (err) {
    if (!(err instanceof discovery.DiscoveryError)) {
      throw err;
    }
  }
};

async function run(ctx: FullStepContext, cachedSteps: CachedStep[] | null) {
  const { page, accumulator, runID, deviceType } = ctx;
  const audioButton = cachedSteps?.at(-1);

  const audioStep = await tracker.track(
    PLAN_TITLE,
    async () => {
      const enablePromise = accumulator.waitFor(
        gelEvents.GEL_EVENT.AUDIO_ENABLE,
        AUDIO_TOGGLE_WAIT_MS,
      );
      const disablePromise = accumulator.waitFor(
        gelEvents.GEL_EVENT.AUDIO_DISABLE,
        AUDIO_TOGGLE_WAIT_MS,
      );

      if (audioButton) {
        await page.mouse.click(audioButton.x, audioButton.y);
      }

      await Promise.all([enablePromise, disablePromise]);
      await screenshot.snap(page, `${runID}/${deviceType}/audio-toggle.png`);
    },
    true,
  );

  return [audioStep];
}

export const audioToggle: Step<FullStepContext> = { stepName, plan, discover, run };

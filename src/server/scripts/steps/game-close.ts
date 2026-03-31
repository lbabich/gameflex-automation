import { GEL_EVENT } from '../../lib/gel-events';
import * as replay from '../../lib/replay';
import * as screenshot from '../../lib/screenshot';
import * as stepCache from '../../lib/step-cache';
import type { Viewport } from '../../types';
import type { FailedButton } from './discovery-loop';
import * as discoveryLoop from './discovery-loop';
import { track } from './track';
import type { StepContext, StepDescriptor } from './types';

const plan: StepDescriptor[] = [{ title: `Game close: ${GEL_EVENT.GAME_CLOSE}` }];

const STEP_NAME = 'gameClose';
const GAME_CLOSE_TIMEOUT_MS = 10_000;
const CLOSE_VERIFY_TIMEOUT_MS = 3_000;

async function discover(ctx: StepContext): Promise<void> {
  const { page, game, viewport, deviceType, runID, accumulator } = ctx;

  if (stepCache.getSteps(game.id, deviceType, viewport, STEP_NAME)) {
    return;
  }

  const verifyCloseClick = () => {
    return accumulator
      .waitFor(GEL_EVENT.GAME_CLOSE, CLOSE_VERIFY_TIMEOUT_MS)
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  };

  return discoveryLoop.runDiscoveryLoop(
    page,
    game,
    viewport,
    deviceType,
    runID,
    STEP_NAME,
    buildNextClickPrompt,
    verifyCloseClick,
  );
}

async function execute(ctx: StepContext): Promise<void> {
  const { page, accumulator, game, viewport, runID, deviceType, runState } = ctx;
  const cached = stepCache.getSteps(game.id, deviceType, viewport, STEP_NAME);

  if (cached) {
    await replay.replaySteps(page, runID, cached.steps, deviceType);
  }

  const gameClosePromise = accumulator.waitFor(GEL_EVENT.GAME_CLOSE, GAME_CLOSE_TIMEOUT_MS);

  const suffix = cached ? ' (cached)' : '';

  await track(runState.steps, `Game close: ${GEL_EVENT.GAME_CLOSE}${suffix}`, async () => {
    await gameClosePromise;
    await screenshot.snap(page, `${runID}/${deviceType}/game-close.png`);
  });
}

function buildNextClickPrompt(viewport: Viewport, failedButtons: FailedButton[]): string {
  const { width, height } = viewport;

  let prompt = `What is the single most important element to click to exit the game?\n\nCRITICAL EXCLUSION — NEVER click anything in the top ${Math.round(height * 0.08)}px strip of the screen (y < ${Math.round(height * 0.08)}). That strip is the harness navigation bar, not part of the game. This includes any home/house icon, back arrow, or any other element positioned there. Clicking it will break the test.\n\nLook for targets in this order:\n1. A home/house icon that is part of the game's own UI — rendered inside the game frame as a game control button (y >= ${Math.round(height * 0.08)}). Click it immediately — this is always the highest priority, even if menus or overlays are currently open.\n2. An exit confirmation button — a button labeled "YES", "Yes", "Confirm", "OK", or similar inside a dialog explicitly asking you to confirm leaving/exiting the game. Only suggest this if the confirmation dialog is currently visible.\n3. A hamburger menu (≡) or settings icon — only if no in-game home icon is visible.\n4. A back arrow (←) to close an overlay or sub-menu blocking navigation.\n\nDo NOT suggest: spin buttons, bet controls, autoplay buttons, win displays, loading bars, or progress indicators.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;

  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((button: FailedButton) => {
        return `- "${button.label}" at (${button.x}, ${button.y})`;
      })
      .join('\n');

    prompt += `\n\nPreviously clicked buttons that did NOT result in game exit — try a different approach:\n${list}`;
  }

  return prompt;
}

export { discover, execute, plan };

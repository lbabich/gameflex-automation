import { GEL_EVENT } from '../../lib/gel-events';
import * as replay from '../../lib/replay';
import * as screenshot from '../../lib/screenshot';
import * as stepCache from '../../lib/step-cache';
import type { Viewport } from '../../types';
import type { FailedButton } from './discovery-loop';
import * as discoveryLoop from './discovery-loop';
import { track } from './track';
import type { StepContext } from './types';

const STEP_NAME = 'gameClose';
const GAME_CLOSE_TIMEOUT_MS = 10_000;

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
    buildGameClosePrompt,
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

  await track(runState.steps, `Game close: ${GEL_EVENT.GAME_CLOSE}${suffix}`, async () => {
    await accumulator.waitFor(GEL_EVENT.GAME_CLOSE, GAME_CLOSE_TIMEOUT_MS);
    await screenshot.snap(page, `${runID}/${deviceType}/game-close.png`);
  });
}

function buildGameClosePrompt(viewport: Viewport, failedButtons: FailedButton[]): string {
  const { width, height } = viewport;

  let prompt = `Is there a confirmation button to finalize exiting the game? This means a button labeled "YES", "Yes", "Confirm", "OK", or similar, appearing inside a dialog that is asking you to confirm the exit — for example "Exit to lobby?", "Are you sure?", "Leave game?", or a similar exit confirmation prompt. Only return {"found": true} when you can see such a confirmation dialog AND the confirm button is visible and directly clickable right now.\n\nDo NOT return {"found": true} for: home icons, house icons, lobby buttons, exit buttons, or navigation items inside a side panel — even if they appear inside an opened menu or drawer. Those are intermediate navigation steps, not the final confirmation. Do NOT return hamburger menus (≡), settings icons, gear icons, or pause buttons.\n\nRespond with exactly one of:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;

  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((button: FailedButton) => {
        return `- "${button.label}" at (${button.x}, ${button.y})`;
      })
      .join('\n');

    prompt += `\n\nPreviously clicked confirmation buttons that did NOT exit the game (do NOT suggest these again):\n${list}\nLook for a different confirmation button.`;
  }

  return prompt;
}

function buildNextClickPrompt(viewport: Viewport, failedButtons: FailedButton[]): string {
  const { width, height } = viewport;

  let prompt = `The game exit confirmation dialog is not yet visible. What is the single most important next click to work toward it?\n\nLook for targets in this order:\n1. A house/home icon — an icon shaped like a house or building silhouette, anywhere in a vertical sidebar, side panel, or navigation drawer along the edge of the screen. If you can see one, click it immediately — this is the highest priority target.\n2. A hamburger menu (≡) — three horizontal lines — only if no sidebar or navigation panel is currently visible.\n3. A dialog or overlay blocking the screen — click the appropriate button to dismiss it.\n\nDo NOT suggest: spin buttons, bet controls, win displays, loading bars, or progress indicators.\nDo NOT suggest: a home icon that is a small shortcut floating alone in the corner of the main game area when no navigation panel is visible anywhere on screen.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;

  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((button: FailedButton) => {
        return `- "${button.label}" at (${button.x}, ${button.y})`;
      })
      .join('\n');

    prompt += `\n\nContext: The following buttons were already clicked but did not open the exit confirmation:\n${list}\nTry a different navigation path.`;
  }

  return prompt;
}

export { discover, execute };

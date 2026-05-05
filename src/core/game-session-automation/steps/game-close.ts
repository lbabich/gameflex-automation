import type { CachedStep } from '../../types';
import * as screenshot from '../capture/screenshot';
import { discoverTarget } from '../discovery';
import { GEL_EVENT } from '../gel/events';
import { gelCheck, onGelEvent } from './step-utils';
import { track } from './track';
import type { SessionContext, StepDescriptor } from './types';

export const plan: StepDescriptor[] = [{ title: `Game close: ${GEL_EVENT.GAME_CLOSE}` }];

export const stepName = 'gameClose';
const GAME_CLOSE_TIMEOUT_MS = 10_000;
const CLOSE_VERIFY_TIMEOUT_MS = 3_000;

export const discover = async (ctx: SessionContext) => {
  await discoverTarget(ctx, {
    stepName,
    defaultInstructions: ({ width, height }) => {
      return `What is the single most important element to click to exit the game?\n\nCRITICAL EXCLUSION — NEVER click anything in the top ${Math.round(height * 0.08)}px strip of the screen (y < ${Math.round(height * 0.08)}). That strip is the harness navigation bar, not part of the game. This includes any home/house icon, back arrow, or any other element positioned there. Clicking it will break the test.\n\nLook for targets in this order:\n1. A home/house icon that is part of the game's own UI — rendered inside the game frame as a game control button (y >= ${Math.round(height * 0.08)}). Click it immediately — this is always the highest priority, even if menus or overlays are currently open.\n2. An exit confirmation button — a button labeled "YES", "Yes", "Confirm", "OK", or similar inside a dialog explicitly asking you to confirm leaving/exiting the game. Only suggest this if the confirmation dialog is currently visible.\n3. A hamburger menu (≡) or settings icon — only if no in-game home icon is visible.\n4. A back arrow (←) to close an overlay or sub-menu blocking navigation.\n\nDo NOT suggest: spin buttons, bet controls, autoplay buttons, win displays, loading bars, or progress indicators.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${width}x${height}`;
    },
    failureContext: (list) => {
      return `Previously clicked buttons that did NOT result in game exit — try a different approach:\n${list}`;
    },
    getHint: (hints) => {
      return hints?.gameClose;
    },
    verifyClick: onGelEvent(GEL_EVENT.GAME_CLOSE, CLOSE_VERIFY_TIMEOUT_MS),
    checkComplete: gelCheck(GEL_EVENT.GAME_CLOSE),
  });
};

export async function run(ctx: SessionContext, _cachedSteps: CachedStep[] | null) {
  const { page, accumulator, runID, deviceType } = ctx;
  const gameClosePromise = accumulator.waitFor(GEL_EVENT.GAME_CLOSE, GAME_CLOSE_TIMEOUT_MS);

  const closeStep = await track(`Game close: ${GEL_EVENT.GAME_CLOSE}`, async () => {
    await gameClosePromise;
    await screenshot.snap(page, `${runID}/${deviceType}/game-close.png`);
  });

  return [closeStep];
}

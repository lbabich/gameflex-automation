import * as fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import type { Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import type { CachedStep, Viewport } from '../types';
import { clickMarker } from './capture/click-marker';
import { screenshot } from './capture/screenshot';
import type { SessionContext } from './steps/types';

dotenv.config();

type ClickResult = { found: true; x: number; y: number; label: string } | { found: false };
type FailedButton = { x: number; y: number; label: string };

export type DiscoverySpec = {
  stepName: string;
  defaultInstructions: (viewport: Viewport) => string;
  failureContext: (list: string) => string;
  getHint: (hints: SessionContext['hints']) => string | undefined;
  verifyClick: (ctx: SessionContext, x: number, y: number) => Promise<boolean>;
  checkComplete?: (ctx: SessionContext) => Promise<boolean>;
};

const VISION_MODEL = 'claude-sonnet-4-6';
const VISION_SYSTEM = 'You are a visual UI analyst. Return ONLY valid JSON.';
const DISCOVERY_MAX_ATTEMPTS = 20;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

async function discoverTarget(ctx: SessionContext, spec: DiscoverySpec): Promise<void> {
  const { page, game, viewport, deviceType, runID, hints, cache } = ctx;

  const cached = cache.getSteps({ id: game.id, deviceType, viewport, stepName: spec.stepName });

  if (cached) {
    return;
  }

  const hint = spec.getHint(hints);
  const allFailedButtons: FailedButton[] = [];
  const preTargetSteps: CachedStep[] = [];

  const commit = () => {
    cache.setSteps(
      { id: game.id, deviceType, viewport, stepName: spec.stepName },
      { discoveredAt: new Date().toISOString(), steps: preTargetSteps },
    );
  };

  let lastClickTime = Date.now();

  for (let attempt = 1; attempt <= DISCOVERY_MAX_ATTEMPTS; attempt++) {
    if (spec.checkComplete && (await spec.checkComplete(ctx))) {
      commit();

      return;
    }

    const prompt = buildPrompt(spec, viewport, hint, allFailedButtons);
    const result = await analyzeScreenshot(page, runID, deviceType, prompt, attempt);

    if (result.found) {
      const waitMs = Date.now() - lastClickTime;

      await clickMarker.injectClickMarker(page, result.x, result.y);
      await screenshot.snap(page, `${runID}/${deviceType}/discovery-${attempt}-click.png`);
      await page.mouse.click(result.x, result.y);

      const verified = await spec.verifyClick(ctx, result.x, result.y);

      preTargetSteps.push({ waitMs, x: result.x, y: result.y, label: result.label });

      if (verified) {
        commit();

        return;
      }

      allFailedButtons.push({ x: result.x, y: result.y, label: result.label });
      lastClickTime = Date.now();
    }

    await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
  }

  await screenshot.snap(page, `${runID}/${deviceType}/discovery-failed.png`);

  throw new DiscoveryError(
    `Could not find target for '${spec.stepName}' on ${game.name} (${game.desktopGameID}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See src/core/data/screenshots/${runID}/${deviceType}/discovery-failed.png`,
  );
}

function buildPrompt(
  spec: DiscoverySpec,
  viewport: Viewport,
  hint: string | undefined,
  failedButtons: FailedButton[],
): string {
  const defaultInstructions = spec.defaultInstructions(viewport);

  if (hint) {
    let prompt = `OPERATOR INSTRUCTION (highest priority — this overrides the default guidance below):\n${hint}\n\nApply the operator instruction above first. If it specifies a sequence of steps, follow them in order and do not skip ahead — re-clicking a previously clicked button is correct if the sequence calls for it. If it specifies constraints or exclusions, honour them while using the default guidance below for anything not covered.\n\n---\n\n${defaultInstructions}`;

    if (failedButtons.length > 0) {
      const list = failedButtons
        .map((b, i) => {
          return `  ${i + 1}. "${b.label}" at (${b.x}, ${b.y})`;
        })
        .join('\n');

      prompt += `\n\nClicks made so far this session (use these to track your position in any sequence — the operator instruction may require revisiting some of them):\n${list}`;
    }

    return prompt;
  }

  let prompt = defaultInstructions;

  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((b) => {
        return `- "${b.label}" at (${b.x}, ${b.y})`;
      })
      .join('\n');

    prompt += `\n\n${spec.failureContext(list)}`;
  }

  return prompt;
}

async function analyzeScreenshot(
  page: Page,
  runID: string,
  deviceType: string,
  prompt: string,
  attempt: number,
): Promise<ClickResult> {
  const path = await screenshot.snap(page, `${runID}/${deviceType}/discovery-${attempt}.png`);

  return queryVision(path, prompt);
}

async function queryVision(screenshotPath: string, prompt: string): Promise<ClickResult> {
  const base64Image = fs.readFileSync(screenshotPath).toString('base64');

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 512,
    system: VISION_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64Image },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonStart = text.lastIndexOf('{');

  if (jsonStart !== -1) {
    try {
      return JSON.parse(text.slice(jsonStart).trim()) as ClickResult;
    } catch {
      // fall through to throw below
    }
  }

  throw new Error(`Claude returned non-JSON: ${text.slice(0, 200)}`);
}

export const discovery = { DiscoveryError, discoverTarget };

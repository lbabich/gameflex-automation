import * as fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import type { Viewport } from './step-cache';

dotenv.config();

export type FailedButton = { x: number; y: number; label: string };

export type SpinResult = { found: true; x: number; y: number; label: string } | { found: false };

export type NextResult = { found: true; x: number; y: number; label: string } | { found: false };

const VISION_MODEL = 'claude-sonnet-4-6';
const SYSTEM = 'You are a visual analyst for browser-based slot games. Return ONLY valid JSON.';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function ask(screenshotPath: string, system: string, userText: string): Promise<unknown> {
  const base64Image = fs.readFileSync(screenshotPath).toString('base64');

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 512,
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: userText,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text.trim());
  } catch {
    throw new Error(`Claude returned non-JSON: ${text.slice(0, 200)}`);
  }
}

export async function detectSpinButton(
  screenshotPath: string,
  viewport: Viewport,
  failedButtons: FailedButton[] = [],
): Promise<SpinResult> {
  const { width: w, height: h } = viewport;
  let prompt = `Is the main spin button visible and unobstructed in this screenshot? It is typically a large circular button — most commonly with clockwise-rotating arrow or arrows around its edge (like a circular refresh/rotate icon), or a play/triangle icon in the centre, or labeled SPIN. It must be fully visible.\n\nRespond with exactly one of:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${w}x${h}`;
  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((b) => {
        return `- "${b.label}" at (${b.x}, ${b.y})`;
      })
      .join('\n');
    prompt += `\n\nPreviously clicked buttons that looked like spin buttons but did NOT trigger a real spin (do NOT click these):\n${list}\nLook for a DIFFERENT spin trigger. If no other candidate exists, return {"found": false} — it is better to say not found than to repeat a known failure.`;
  }
  const result = (await ask(screenshotPath, SYSTEM, prompt)) as Record<string, unknown>;
  if (result.found !== true && result.found !== false) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(result)}`);
  }
  return result as unknown as SpinResult;
}

export async function detectNextClick(
  screenshotPath: string,
  viewport: Viewport,
  failedButtons: FailedButton[] = [],
): Promise<NextResult> {
  const { width: w, height: h } = viewport;
  let prompt = `The spin button is not yet accessible. What is the single most important element to click to progress — a dialog button (Continue, OK, Accept, Yes, No), close X, age/terms prompt, overlay, or promo/bonus intro screen? Also includes full-screen brand logo or game-title splash screens with no spin UI visible — if you see one, return the centre of the screen as the click target. If the screen appears fully interactive with no blockers and no splash (spin button may still be loading), return {"found": false}.\n\nDo NOT suggest clicking loading bars, progress indicators, loading spinners, or percentage counters — these are not interactive elements. If the game is still loading (spinner visible, assets loading), return {"found": false}.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${w}x${h}`;
  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((b) => {
        return `- "${b.label}" at (${b.x}, ${b.y})`;
      })
      .join('\n');
    prompt += `\n\nContext: The following buttons were clicked as spin candidates but did not trigger a spin:\n${list}\nFeel free to suggest clicking a Back/Cancel/navigation button or another UI path to reach a different game state where the real spin button may be accessible.`;
  }
  const result = (await ask(screenshotPath, SYSTEM, prompt)) as Record<string, unknown>;
  if (result.found !== true && result.found !== false) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(result)}`);
  }
  return result as unknown as NextResult;
}

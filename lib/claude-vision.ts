import * as fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import type { Viewport } from './step-cache';

dotenv.config();

export type SpinResult = { found: true; x: number; y: number; label: string } | { found: false };

export type NextResult = { found: true; x: number; y: number; label: string } | { found: false };

const VISION_MODEL = 'claude-sonnet-4-6';
const SYSTEM = 'You are a visual analyst for browser-based slot games. Return ONLY valid JSON.';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function ask(
  screenshotPath: string,
  system: string,
  userText: string,
): Promise<unknown> {
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
  return JSON.parse(text.trim());
}

export async function detectSpinButton(
  screenshotPath: string,
  viewport: Viewport,
): Promise<SpinResult> {
  const { width: w, height: h } = viewport;
  const result = await ask(
    screenshotPath,
    SYSTEM,
    `Is the main spin button visible and unobstructed in this screenshot? It is typically a large circular button labeled SPIN or with a play/arrow icon, not greyed out or hidden behind a modal.\n\nRespond with exactly one of:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${w}x${h}`,
  );
  return result as SpinResult;
}

export async function detectNextClick(
  screenshotPath: string,
  viewport: Viewport,
): Promise<NextResult> {
  const { width: w, height: h } = viewport;
  const result = await ask(
    screenshotPath,
    SYSTEM,
    `The spin button is not yet accessible. What is the single most important element to click to progress — a dialog button (Continue, OK, Accept), close X, age/terms prompt, or overlay? If the screen appears fully interactive with no blockers (spin button may still be loading), return {"found": false}.\n\nRespond with:\n  {"found": false}\n  {"found": true, "x": <number>, "y": <number>, "label": "<short description>"}\n\nImage dimensions: ${w}x${h}`,
  );
  return result as NextResult;
}

import * as fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import type { Viewport } from '../types';

dotenv.config();

export type ClickResult = { found: true; x: number; y: number; label: string } | { found: false };

export type VisionContext = {
  viewport: Viewport;
  hint: string | undefined;
  failedButtons: ReadonlyArray<{ x: number; y: number; label: string }>;
  instructions: (viewport: Viewport) => string;
  failureInstructions: string;
};

export type VisionAnalyzer = {
  analyze: (screenshotPath: string, context: VisionContext) => Promise<ClickResult>;
};

const VISION_MODEL = 'claude-sonnet-4-6';
const VISION_SYSTEM = 'You are a visual UI analyst. Return ONLY valid JSON.';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL
});

async function analyze(screenshotPath: string, context: VisionContext): Promise<ClickResult> {
  const prompt = buildPrompt(context);
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

function buildPrompt(context: VisionContext): string {
  const { viewport, hint, failedButtons, instructions, failureInstructions } = context;
  const instructionText = instructions(viewport);

  if (hint) {
    let prompt = `OPERATOR INSTRUCTION (highest priority — this overrides the default guidance below):\n${hint}\n\nApply the operator instruction above first. If it specifies a sequence of steps, follow them in order and do not skip ahead — re-clicking a previously clicked button is correct if the sequence calls for it. If it specifies constraints or exclusions, honour them while using the default guidance below for anything not covered.\n\n---\n\n${instructionText}`;

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

  let prompt = instructionText;

  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((b) => {
        return `- "${b.label}" at (${b.x}, ${b.y})`;
      })
      .join('\n');

    prompt += `\n\n${failureInstructions.replace('{failedList}', list)}`;
  }

  return prompt;
}

export const claudeVisionAnalyzer: VisionAnalyzer = { analyze };

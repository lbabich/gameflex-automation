import * as fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

type ClickResult = { found: true; x: number; y: number; label: string } | { found: false };

const VISION_MODEL = 'claude-sonnet-4-6';
const SYSTEM = 'You are a visual UI analyst. Return ONLY valid JSON.';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function query(screenshotPath: string, prompt: string): Promise<ClickResult> {
  const base64Image = fs.readFileSync(screenshotPath).toString('base64');

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 512,
    system: SYSTEM,
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
            text: prompt,
          },
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

export { query };

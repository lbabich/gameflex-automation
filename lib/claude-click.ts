import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { getCached, setCached, DeviceType } from './click-cache';

dotenv.config();

const VISION_MODEL = 'claude-sonnet-4-6';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function getClickCoords(
  screenshotPath: string,
  prompt: string,
  viewport: { width: number; height: number },
  context: { gameId: string; deviceType: DeviceType }
): Promise<{ x: number; y: number }> {
  const cached = getCached(context.gameId, context.deviceType, viewport, prompt);
  if (cached) {
    console.log('Cache hit:', prompt);
    return cached;
  }
  const imageData = fs.readFileSync(screenshotPath);
  const base64Image = imageData.toString('base64');

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 256,
    system:
      'You are analyzing a browser screenshot. Return ONLY a JSON object {x, y} with the pixel coordinates to click for the described element. No explanation.',
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
            text: `${prompt}\nImage dimensions: ${viewport.width}x${viewport.height}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const match = text.match(/\{[^}]*"x"\s*:\s*\d+[^}]*"y"\s*:\s*\d+[^}]*\}|\{[^}]*"y"\s*:\s*\d+[^}]*"x"\s*:\s*\d+[^}]*\}/);
  if (!match) {
    throw new Error(`Claude returned unexpected response: ${text}`);
  }
  const parsed: unknown = JSON.parse(match[0]);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).x !== 'number' ||
    typeof (parsed as Record<string, unknown>).y !== 'number'
  ) {
    throw new Error(`Claude returned invalid coordinates: ${match[0]}`);
  }
  const coords = parsed as { x: number; y: number };
  setCached(context.gameId, context.deviceType, viewport, prompt, coords);
  return coords;
}

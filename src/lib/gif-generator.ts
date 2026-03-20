import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { Jimp } from 'jimp';
import type { DeviceType } from './types';

type GifEncoderInstance = {
  setDelay(ms: number): void;
  setRepeat(n: number): void;
  start(): void;
  addFrame(pixels: Uint8ClampedArray): void;
  finish(): void;
  out: { getData(): Buffer };
};

type GifEncoderConstructor = new (width: number, height: number) => GifEncoderInstance;

// gif-encoder-2 ships no ESM build or TypeScript declarations; createRequire loads it from ESM
const require = createRequire(import.meta.url);
const GIFEncoder = require('gif-encoder-2') as GifEncoderConstructor;

const GIF_WIDTH = 640;
const GIF_HEIGHT = 360;
const GIF_DELAY_MS = 1000;

export const ANIMATED_GIF_FILENAME = 'animated.gif';

function parseSortKey(filename: string): [number, number] {
  const base = path.basename(filename, '.png');
  const discoveryMatch = base.match(/^discovery-(\d+)$/);

  if (discoveryMatch) {
    return [0, Number.parseInt(discoveryMatch[1], 10)];
  }

  const stepMatch = base.match(/^step-(\d+)$/);

  if (stepMatch) {
    return [1, Number.parseInt(stepMatch[1], 10)];
  }

  if (base === 'spin-start') {
    return [2, 0];
  }

  const finalMatch = base.match(/^final(?:-(\d+))?$/);

  if (finalMatch) {
    return [3, finalMatch[1] ? Number.parseInt(finalMatch[1], 10) : 0];
  }

  return [4, 0];
}

/**
 * Encodes all PNG screenshots for `gameId`/`deviceType` into an animated GIF at
 * `src/server/screenshots/<gameId>/<deviceType>/animated.gif`, then deletes the source PNGs.
 * Returns the absolute path to the generated GIF.
 * @throws if no PNG files exist in the screenshots directory
 */
export async function generateGif(gameID: string, deviceType: DeviceType) {
  const screenshotsDir = path.resolve('src/server/screenshots', gameID, deviceType);
  const gifPath = path.resolve(screenshotsDir, ANIMATED_GIF_FILENAME);

  const pngFiles = fs
    .readdirSync(screenshotsDir)
    .filter((filename) => {
      return filename.endsWith('.png');
    })
    .sort((a, b) => {
      const [aGroup, aIdx] = parseSortKey(a);
      const [bGroup, bIdx] = parseSortKey(b);
      return aGroup !== bGroup ? aGroup - bGroup : aIdx - bIdx;
    });

  if (pngFiles.length === 0) {
    throw new Error(`No PNG files found in ${screenshotsDir}`);
  }

  const encoder = new GIFEncoder(GIF_WIDTH, GIF_HEIGHT);

  encoder.setDelay(GIF_DELAY_MS);
  encoder.setRepeat(0);
  encoder.start();

  for (const file of pngFiles) {
    const filePath = path.join(screenshotsDir, file);
    const image = await Jimp.read(filePath);

    image.resize({ w: GIF_WIDTH, h: GIF_HEIGHT });
    encoder.addFrame(new Uint8ClampedArray(image.bitmap.data.buffer));
  }

  encoder.finish();
  fs.writeFileSync(gifPath, encoder.out.getData());

  for (const file of pngFiles) {
    fs.unlinkSync(path.join(screenshotsDir, file));
  }

  return gifPath;
}

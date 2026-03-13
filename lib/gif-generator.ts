import * as fs from 'node:fs';
import * as path from 'node:path';
import { Jimp } from 'jimp';

type GifEncoderInstance = {
  setDelay(ms: number): void;
  setRepeat(n: number): void;
  start(): void;
  addFrame(pixels: Uint8ClampedArray): void;
  finish(): void;
  out: { getData(): Buffer };
};

type GifEncoderConstructor = new (width: number, height: number) => GifEncoderInstance;

// require() is intentional: gif-encoder-2 ships no ESM build or TypeScript declarations
const GIFEncoder = require('gif-encoder-2') as GifEncoderConstructor;

const GIF_WIDTH = 640;
const GIF_HEIGHT = 360;
const GIF_DELAY_MS = 1000;

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
  if (base === 'final') {
    return [2, 0];
  }
  return [3, 0];
}

export async function generateGif(gameId: string): Promise<string> {
  const screenshotsDir = path.resolve('screenshots', gameId);
  const gifPath = path.resolve(screenshotsDir, 'animated.gif');

  const pngFiles = fs
    .readdirSync(screenshotsDir)
    .filter((f) => {
      return f.endsWith('.png');
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

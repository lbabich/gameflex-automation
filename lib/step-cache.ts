import * as fs from 'node:fs';
import * as path from 'node:path';

export type DeviceType = 'desktop' | 'mobile';

export type Viewport = {
  width: number;
  height: number;
};

export type CachedStep = {
  waitMs: number;
  x: number;
  y: number;
  label: string;
};

export type GameSteps = {
  discoveredAt: string;
  steps: CachedStep[];
};

type ViewportMap = Record<string, GameSteps>;
type DeviceMap = Record<string, ViewportMap>;
type StepCache = Record<string, DeviceMap>;

const CACHE_PATH = path.resolve('data', 'game-steps.json');

function loadCache(): StepCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as StepCache;
  } catch {
    return {};
  }
}

function saveCache(cache: StepCache): void {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function viewportKey(viewport: Viewport): string {
  return `${viewport.width}x${viewport.height}`;
}

export function getSteps(
  gameId: string,
  deviceType: DeviceType,
  viewport: Viewport,
): GameSteps | undefined {
  const cache = loadCache();
  return cache[gameId]?.[deviceType]?.[viewportKey(viewport)];
}

export function setSteps(
  gameId: string,
  deviceType: DeviceType,
  viewport: Viewport,
  steps: GameSteps,
): void {
  const cache = loadCache();
  const vk = viewportKey(viewport);

  cache[gameId] ??= {};
  cache[gameId][deviceType] ??= {};
  cache[gameId][deviceType][vk] = steps;

  saveCache(cache);
}

export function clearSteps(
  gameId: string,
  deviceType: DeviceType,
  viewport: Viewport,
): void {
  const cache = loadCache();
  const vk = viewportKey(viewport);
  if (cache[gameId]?.[deviceType]?.[vk]) {
    delete cache[gameId][deviceType][vk];
    saveCache(cache);
  }
}

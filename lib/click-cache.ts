import * as fs from 'fs';
import * as path from 'path';

export type DeviceType = 'desktop' | 'mobile';

const CACHE_PATH = path.resolve('data', 'click-coords.json');

interface Coords {
  x: number;
  y: number;
}
type PromptMap = Record<string, Coords>;
type ViewportMap = Record<string, PromptMap>;
type DeviceMap = Record<string, ViewportMap>;
type GameCache = Record<string, DeviceMap>;

function loadCache(): GameCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as GameCache;
  } catch (err) {
    console.warn('click-cache: failed to load cache, starting fresh.', err);
    return {};
  }
}

function saveCache(cache: GameCache): void {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function viewportKey(viewport: { width: number; height: number }): string {
  return `${viewport.width}x${viewport.height}`;
}

export function getCached(
  gameId: string,
  deviceType: DeviceType,
  viewport: { width: number; height: number },
  prompt: string,
): Coords | undefined {
  const cache = loadCache();
  return cache[gameId]?.[deviceType]?.[viewportKey(viewport)]?.[prompt];
}

export function setCached(
  gameId: string,
  deviceType: DeviceType,
  viewport: { width: number; height: number },
  prompt: string,
  coords: Coords,
): void {
  const cache = loadCache();
  const vk = viewportKey(viewport);
  cache[gameId] ??= {};
  cache[gameId][deviceType] ??= {};
  cache[gameId][deviceType][vk] ??= {};
  cache[gameId][deviceType][vk][prompt] = coords;
  saveCache(cache);
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DeviceType, GameSteps, Viewport } from './types';

type ViewportMap = Record<string, GameSteps>;
type DeviceMap = Record<string, ViewportMap>;
type StepCache = Record<string, DeviceMap>;

const CACHE_PATH = path.resolve('src', 'data', 'game-steps.json');

function loadCache(): StepCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as StepCache;
  } catch (error) {
    console.warn('[step-cache] Failed to load cache, starting fresh:', error);
    return {};
  }
}

function saveCache(cache: StepCache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function viewportKey(viewport: Viewport) {
  return `${viewport.width}x${viewport.height}`;
}

export function getSteps(id: string, deviceType: DeviceType, viewport: Viewport) {
  const cache = loadCache();
  return cache[id]?.[deviceType]?.[viewportKey(viewport)];
}

/**
 * Merges `steps` into the cache at `[id][deviceType][viewportKey]`.
 * Reads the cache file from disk on every call and writes it back after updating — no in-memory state.
 */
export function setSteps(id: string, deviceType: DeviceType, viewport: Viewport, steps: GameSteps) {
  const cache = loadCache();
  const key = viewportKey(viewport);

  cache[id] ??= {};
  cache[id][deviceType] ??= {};
  cache[id][deviceType][key] = steps;

  saveCache(cache);
}

export function clearAllSteps(id: string) {
  const cache = loadCache();

  if (cache[id]) {
    delete cache[id];
    saveCache(cache);
  }
}

export function clearChannelSteps(id: string, deviceType: DeviceType) {
  const cache = loadCache();

  if (cache[id]?.[deviceType]) {
    delete cache[id][deviceType];

    if (Object.keys(cache[id]).length === 0) {
      delete cache[id];
    }

    saveCache(cache);
  }
}

export function getCachedDeviceMap() {
  const cache = loadCache();
  const result = new Map<string, { desktop: boolean; mobile: boolean }>();

  for (const [gameID, devices] of Object.entries(cache)) {
    result.set(gameID, {
      desktop: 'desktop' in devices,
      mobile: 'mobile' in devices,
    });
  }

  return result;
}

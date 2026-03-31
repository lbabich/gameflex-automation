import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DeviceType } from '../../shared/types';
import type { GameSteps, Viewport } from '../types';

type StepMap = Record<string, GameSteps>;
type ViewportMap = Record<string, StepMap>;
type DeviceMap = Record<string, ViewportMap>;
type StepCache = Record<string, DeviceMap>;

type StepCacheKey = {
  id: string;
  deviceType: DeviceType;
  viewport: Viewport;
  stepName: string;
};

const CACHE_PATH = path.resolve('src', 'server', 'data', 'game-steps.json');

const pending = new Map<string, GameSteps>();

function getSteps(key: StepCacheKey) {
  const cache = loadCache();

  return cache[key.id]?.[key.deviceType]?.[viewportKey(key.viewport)]?.[key.stepName];
}

/**
 * Writes directly to disk. Use for partial/failure saves where you want the
 * result preserved even if the overall run fails.
 */
function setSteps(key: StepCacheKey, steps: GameSteps) {
  const cache = loadCache();
  const vpKey = viewportKey(key.viewport);

  cache[key.id] ??= {};
  cache[key.id][key.deviceType] ??= {};
  cache[key.id][key.deviceType][vpKey] ??= {};
  cache[key.id][key.deviceType][vpKey][key.stepName] = steps;

  saveCache(cache);
}

/**
 * Stores steps in memory only. Call saveToCache() once all discovery
 * steps have succeeded to write everything to disk atomically.
 */
function setPendingSteps(key: StepCacheKey, steps: GameSteps) {
  pending.set(pendingKey(key), steps);
}

/**
 * Writes all pending in-memory steps to disk and clears the pending map.
 * Call this after all discovery steps have completed successfully.
 */
function saveToCache() {
  if (pending.size === 0) {
    return;
  }

  const cache = loadCache();

  for (const [key, steps] of pending.entries()) {
    const [id, deviceType, vpKey, stepName] = key.split('/');

    cache[id] ??= {};
    cache[id][deviceType] ??= {};
    cache[id][deviceType][vpKey] ??= {};
    cache[id][deviceType][vpKey][stepName] = steps;
  }

  saveCache(cache);
  pending.clear();
}

function clearAllSteps(id: string) {
  const cache = loadCache();

  if (cache[id]) {
    delete cache[id];
    saveCache(cache);
  }
}

function clearChannelSteps(id: string, deviceType: DeviceType) {
  const cache = loadCache();

  if (cache[id]?.[deviceType]) {
    delete cache[id][deviceType];

    if (Object.keys(cache[id]).length === 0) {
      delete cache[id];
    }

    saveCache(cache);
  }
}

function getCachedDeviceMap() {
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

function pendingKey(key: StepCacheKey): string {
  return `${key.id}/${key.deviceType}/${viewportKey(key.viewport)}/${key.stepName}`;
}

function viewportKey(viewport: Viewport) {
  return `${viewport.width}x${viewport.height}`;
}

export type { StepCacheKey };
export {
  getSteps,
  setSteps,
  setPendingSteps,
  saveToCache,
  clearAllSteps,
  clearChannelSteps,
  getCachedDeviceMap,
};

import { describe, expect, it } from 'vitest';
import { cache, type StepCache, type StepStore } from '../cache';

const VP_DESK = { width: 1280, height: 720 };
const VP_MOB = { width: 390, height: 844 };
const STEP = 'spin-cycle';

describe('step-cache', () => {
  it('round-trips steps by id', () => {
    const SUT = cache.createStepCache(createMemoryStore());
    const id = 'game-1';
    const steps = {
      discoveredAt: '2024-01-01T00:00:00Z',
      steps: [{ waitMs: 100, x: 10, y: 20, label: 'spin' }],
    };

    SUT.setSteps({ id, deviceType: 'desktop', viewport: VP_DESK, stepName: STEP }, steps);

    const result = SUT.getSteps({ id, deviceType: 'desktop', viewport: VP_DESK, stepName: STEP });

    expect(result).toEqual(steps);
  });

  it('keeps desktop and mobile steps separate under the same id', () => {
    const SUT = cache.createStepCache(createMemoryStore());
    const id = 'game-1';
    const desktopSteps = {
      discoveredAt: '2024-01-01T00:00:00Z',
      steps: [{ waitMs: 1000, x: 100, y: 200, label: 'desktop-spin' }],
    };
    const mobileSteps = {
      discoveredAt: '2024-01-02T00:00:00Z',
      steps: [{ waitMs: 500, x: 50, y: 80, label: 'mobile-spin' }],
    };

    SUT.setSteps({ id, deviceType: 'desktop', viewport: VP_DESK, stepName: STEP }, desktopSteps);
    SUT.setSteps({ id, deviceType: 'mobile', viewport: VP_MOB, stepName: STEP }, mobileSteps);

    const resultDesktop = SUT.getSteps({
      id,
      deviceType: 'desktop',
      viewport: VP_DESK,
      stepName: STEP,
    });
    const resultMobile = SUT.getSteps({
      id,
      deviceType: 'mobile',
      viewport: VP_MOB,
      stepName: STEP,
    });

    expect(resultDesktop).toEqual(desktopSteps);
    expect(resultMobile).toEqual(mobileSteps);
  });

  it('clearAllSteps removes all device type entries for an id', () => {
    const SUT = cache.createStepCache(createMemoryStore());
    const id = 'game-1';
    const steps = { discoveredAt: '2024-01-01T00:00:00Z', steps: [] };

    SUT.setSteps({ id, deviceType: 'desktop', viewport: VP_DESK, stepName: STEP }, steps);
    SUT.setSteps({ id, deviceType: 'mobile', viewport: VP_MOB, stepName: STEP }, steps);

    SUT.clearAllSteps(id);

    const resultDesktop = SUT.getSteps({
      id,
      deviceType: 'desktop',
      viewport: VP_DESK,
      stepName: STEP,
    });
    const resultMobile = SUT.getSteps({
      id,
      deviceType: 'mobile',
      viewport: VP_MOB,
      stepName: STEP,
    });

    expect(resultDesktop).toBeUndefined();
    expect(resultMobile).toBeUndefined();
  });
});

function createMemoryStore(initial: StepCache = {}): StepStore {
  let data: StepCache = initial;

  return {
    load() {
      return data;
    },

    save(cache: StepCache) {
      data = cache;
    },
  };
}

import * as crypto from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import * as stepCache from '../../lib/step-cache';

// Each test uses freshly-generated GUIDs so tests are isolated without
// mocking the file path. Entries are cleaned up in the afterAll hook.

const created: Array<{ id: string }> = [];

function makeId(): string {
  const id = crypto.randomUUID();

  created.push({ id });

  return id;
}

const VP_DESK = { width: 1280, height: 720 };
const VP_MOB = { width: 390, height: 844 };

describe('step-cache', () => {
  afterAll(() => {
    for (const { id } of created) {
      stepCache.clearAllSteps(id);
    }
  });

  it('round-trips steps by GUID', () => {
    const SUT = stepCache;
    const id = makeId();
    const steps = {
      discoveredAt: '2024-01-01T00:00:00Z',
      steps: [{ waitMs: 100, x: 10, y: 20, label: 'spin' }],
    };

    SUT.setSteps(id, 'desktop', VP_DESK, steps);

    const result = SUT.getSteps(id, 'desktop', VP_DESK);

    expect(result).toEqual(steps);
  });

  it('keeps desktop and mobile steps separate under the same GUID', () => {
    const SUT = stepCache;
    const id = makeId();
    const desktopSteps = {
      discoveredAt: '2024-01-01T00:00:00Z',
      steps: [{ waitMs: 1000, x: 100, y: 200, label: 'desktop-spin' }],
    };
    const mobileSteps = {
      discoveredAt: '2024-01-02T00:00:00Z',
      steps: [{ waitMs: 500, x: 50, y: 80, label: 'mobile-spin' }],
    };

    SUT.setSteps(id, 'desktop', VP_DESK, desktopSteps);
    SUT.setSteps(id, 'mobile', VP_MOB, mobileSteps);

    const resultDesktop = SUT.getSteps(id, 'desktop', VP_DESK);
    const resultMobile = SUT.getSteps(id, 'mobile', VP_MOB);

    expect(resultDesktop).toEqual(desktopSteps);
    expect(resultMobile).toEqual(mobileSteps);
  });

  it('clearAllSteps removes all device type entries for a GUID', () => {
    const SUT = stepCache;
    const id = makeId();
    const steps = { discoveredAt: '2024-01-01T00:00:00Z', steps: [] };

    SUT.setSteps(id, 'desktop', VP_DESK, steps);
    SUT.setSteps(id, 'mobile', VP_MOB, steps);

    SUT.clearAllSteps(id);

    const resultDesktop = SUT.getSteps(id, 'desktop', VP_DESK);
    const resultMobile = SUT.getSteps(id, 'mobile', VP_MOB);

    expect(resultDesktop).toBeUndefined();
    expect(resultMobile).toBeUndefined();
  });
});

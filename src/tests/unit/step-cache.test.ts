import * as crypto from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import * as stepCache from '../../lib/step-cache.ts';

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
    const id = makeId();
    const steps = {
      discoveredAt: '2024-01-01T00:00:00Z',
      steps: [{ waitMs: 100, x: 10, y: 20, label: 'spin' }],
    };

    stepCache.setSteps(id, 'desktop', VP_DESK, steps);

    const result = stepCache.getSteps(id, 'desktop', VP_DESK);

    expect(result).toEqual(steps);
  });

  it('keeps desktop and mobile steps separate under the same GUID', () => {
    const id = makeId();
    const desktopSteps = {
      discoveredAt: '2024-01-01T00:00:00Z',
      steps: [{ waitMs: 1000, x: 100, y: 200, label: 'desktop-spin' }],
    };
    const mobileSteps = {
      discoveredAt: '2024-01-02T00:00:00Z',
      steps: [{ waitMs: 500, x: 50, y: 80, label: 'mobile-spin' }],
    };

    stepCache.setSteps(id, 'desktop', VP_DESK, desktopSteps);
    stepCache.setSteps(id, 'mobile', VP_MOB, mobileSteps);

    expect(stepCache.getSteps(id, 'desktop', VP_DESK)).toEqual(desktopSteps);
    expect(stepCache.getSteps(id, 'mobile', VP_MOB)).toEqual(mobileSteps);
  });

  it('clearAllSteps removes all device type entries for a GUID', () => {
    const id = makeId();
    const steps = { discoveredAt: '2024-01-01T00:00:00Z', steps: [] };

    stepCache.setSteps(id, 'desktop', VP_DESK, steps);
    stepCache.setSteps(id, 'mobile', VP_MOB, steps);

    stepCache.clearAllSteps(id);

    expect(stepCache.getSteps(id, 'desktop', VP_DESK)).toBeUndefined();
    expect(stepCache.getSteps(id, 'mobile', VP_MOB)).toBeUndefined();
  });

});

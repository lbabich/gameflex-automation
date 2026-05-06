import type { Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEntry } from '../../shared/types';
import type { NodeStepCache } from '../step-cache/cache';
import { discovery } from './discovery';
import type { ClickResult, VisionAnalyzer } from './vision-analyzer';

vi.mock('./capture/screenshot', () => {
  return {
    screenshot: { snap: vi.fn().mockResolvedValue('/fake/screenshot.png') },
  };
});

vi.mock('./capture/click-marker', () => {
  return {
    clickMarker: { injectClickMarker: vi.fn().mockResolvedValue(undefined) },
  };
});

const GAME: GameEntry = {
  id: 'game-id',
  desktopGameID: '12345',
  name: 'Test Game',
  gameProviderID: 'provider',
};

const VIEWPORT = { width: 1280, height: 720 };

function makeVisionAnalyzer(results: ClickResult[]): VisionAnalyzer {
  let i = 0;

  return {
    analyze: vi.fn().mockImplementation(() => {
      return Promise.resolve(results[i++] ?? { found: false });
    }),
  };
}

function makePage() {
  return {
    mouse: { click: vi.fn().mockResolvedValue(undefined) },
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

function makeCache(hit = false): NodeStepCache {
  return {
    getSteps: vi.fn().mockReturnValue(hit ? { discoveredAt: '', steps: [] } : null),
    setSteps: vi.fn(),
  } as unknown as NodeStepCache;
}

function makeSpec(overrides: Partial<Parameters<typeof discovery.discoverTarget>[1]> = {}) {
  return {
    stepName: 'spinCycle',
    defaultInstructions: () => {
      return 'Find the spin button.';
    },
    failureContext: (list: string) => {
      return `These failed: ${list}`;
    },
    getHint: () => {
      return undefined;
    },
    verifyClick: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeCtx(
  visionAnalyzer: VisionAnalyzer,
  cache: NodeStepCache = makeCache(),
  page = makePage(),
) {
  return {
    page,
    game: GAME,
    viewport: VIEWPORT,
    deviceType: 'desktop' as const,
    runID: 'run-123',
    cache,
    hints: undefined,
    visionAnalyzer,
  };
}

describe('decide', () => {
  it('returns commit when found and verified', () => {
    expect(discovery.decide({ found: true, x: 100, y: 200, label: 'Spin' }, true)).toBe('commit');
  });

  it('returns falsePositive when found but not verified', () => {
    expect(discovery.decide({ found: true, x: 100, y: 200, label: 'Spin' }, false)).toBe(
      'falsePositive',
    );
  });

  it('returns continue when not found', () => {
    expect(discovery.decide({ found: false }, false)).toBe('continue');
  });
});

describe('discoverTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns immediately on cache hit without calling vision analyzer', async () => {
    const analyzer = makeVisionAnalyzer([]);
    const ctx = makeCtx(analyzer, makeCache(true));
    const spec = makeSpec();

    await discovery.discoverTarget(ctx, spec);

    expect(analyzer.analyze).not.toHaveBeenCalled();
    expect(ctx.cache.setSteps).not.toHaveBeenCalled();
  });

  it('commits and returns when found and verified on first attempt', async () => {
    const analyzer = makeVisionAnalyzer([{ found: true, x: 100, y: 200, label: 'Spin' }]);
    const cache = makeCache();
    const ctx = makeCtx(analyzer, cache);
    const spec = makeSpec();

    await discovery.discoverTarget(ctx, spec);

    expect(cache.setSteps).toHaveBeenCalledOnce();

    const [, gameSteps] = (cache.setSteps as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(gameSteps.steps).toHaveLength(1);
    expect(gameSteps.steps[0]).toMatchObject({ x: 100, y: 200, label: 'Spin' });
  });

  it('accumulates pre-target steps across multiple found+unverified clicks before success', async () => {
    const analyzer = makeVisionAnalyzer([
      { found: true, x: 50, y: 60, label: 'Continue' },
      { found: true, x: 100, y: 200, label: 'Spin' },
    ]);
    const cache = makeCache();
    const ctx = makeCtx(analyzer, cache);
    const spec = makeSpec({
      verifyClick: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    });

    await discovery.discoverTarget(ctx, spec);

    const [, gameSteps] = (cache.setSteps as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(gameSteps.steps).toHaveLength(2);
    expect(gameSteps.steps[0]).toMatchObject({ x: 50, y: 60, label: 'Continue' });
    expect(gameSteps.steps[1]).toMatchObject({ x: 100, y: 200, label: 'Spin' });
  });

  it('skips vision analyzer and commits when checkComplete returns true', async () => {
    const analyzer = makeVisionAnalyzer([]);
    const cache = makeCache();
    const ctx = makeCtx(analyzer, cache);
    const spec = makeSpec({ checkComplete: vi.fn().mockResolvedValue(true) });

    await discovery.discoverTarget(ctx, spec);

    expect(analyzer.analyze).not.toHaveBeenCalled();
    expect(cache.setSteps).toHaveBeenCalledOnce();
  });

  it('throws DiscoveryError after exhausting all attempts', async () => {
    const notFound: ClickResult = { found: false };
    const analyzer = makeVisionAnalyzer(Array(20).fill(notFound));
    const ctx = makeCtx(analyzer);
    const spec = makeSpec();

    await expect(discovery.discoverTarget(ctx, spec)).rejects.toBeInstanceOf(
      discovery.DiscoveryError,
    );

    expect(analyzer.analyze).toHaveBeenCalledTimes(20);
    expect(ctx.cache.setSteps).not.toHaveBeenCalled();
  });

  it('passes failed buttons in vision context after an unverified click', async () => {
    const analyzer = makeVisionAnalyzer([
      { found: true, x: 50, y: 60, label: 'Wrong' },
      { found: true, x: 100, y: 200, label: 'Spin' },
    ]);
    const ctx = makeCtx(analyzer);
    const spec = makeSpec({
      verifyClick: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    });

    await discovery.discoverTarget(ctx, spec);

    const secondCall = (analyzer.analyze as ReturnType<typeof vi.fn>).mock.calls[1];
    const visionContext = secondCall[1];

    expect(visionContext.failedButtons).toHaveLength(1);
    expect(visionContext.failedButtons[0]).toMatchObject({ x: 50, y: 60, label: 'Wrong' });
  });
});

import type { Page } from '@playwright/test';
import type { DeviceType, GameEntry, RunHints, TestStep } from '../../../shared/types';
import type { NodeStepCache } from '../../step-cache/cache';
import type { CachedStep, Viewport } from '../../types';
import type { EventAccumulator } from '../gel/accumulator';
import type { VisionAnalyzer } from '../vision-analyzer';

export type DiscoveryContext = {
  page: Page;
  game: GameEntry;
  viewport: Viewport;
  deviceType: DeviceType;
  runID: string;
  cache: NodeStepCache;
  hints?: RunHints;
  visionAnalyzer: VisionAnalyzer;
};

export type FullStepContext = DiscoveryContext & {
  accumulator: EventAccumulator;
};

export type StepDescriptor = {
  title: string;
  optional?: boolean;
};

export type Step<TCtx> = {
  plan: StepDescriptor[];
  stepName: string;
  discover: (ctx: TCtx) => Promise<void>;
  run: (ctx: TCtx, cachedSteps: CachedStep[] | null) => Promise<TestStep[]>;
};

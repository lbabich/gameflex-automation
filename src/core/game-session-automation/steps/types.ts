import type { Page } from '@playwright/test';
import type { DeviceType, GameEntry, RunHints, TestStep } from '../../../shared/types';
import type { NodeStepCache } from '../../step-cache/cache';
import type { CachedStep, Viewport } from '../../types';
import type { EventAccumulator } from '../gel/accumulator';

export type SessionContext = {
  page: Page;
  accumulator: EventAccumulator;
  game: GameEntry;
  viewport: Viewport;
  deviceType: DeviceType;
  runID: string;
  cache: NodeStepCache;
  hints?: RunHints;
};

export type StepDescriptor = {
  title: string;
  optional?: boolean;
};

export type Step = {
  plan: StepDescriptor[];
  stepName: string;
  discover: (ctx: SessionContext) => Promise<void>;
  run: (ctx: SessionContext, cachedSteps: CachedStep[] | null) => Promise<TestStep[]>;
};

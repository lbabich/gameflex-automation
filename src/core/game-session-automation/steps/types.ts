import type { Page } from '@playwright/test';
import type { DeviceType, GameEntry, RunHints, TestStep } from '../../../shared/types';
import type { NodeStepCache } from '../../step-cache';
import type { Viewport } from '../../types';
import type { EventAccumulator } from '../event-accumulator';

type SessionContext = {
  page: Page;
  accumulator: EventAccumulator;
  game: GameEntry;
  viewport: Viewport;
  deviceType: DeviceType;
  runID: string;
  cache: NodeStepCache;
  hints?: RunHints;
};

type StepDescriptor = {
  title: string;
  optional?: boolean;
};

type Step = {
  plan: StepDescriptor[];
  discover: (ctx: SessionContext) => Promise<void>;
  execute: (ctx: SessionContext) => Promise<TestStep[]>;
};

export type { SessionContext, Step, StepDescriptor };

import type { Page } from '@playwright/test';
import type { DeviceType, GameEntry, RunHints, TestStep } from '../../../shared/types';
import type { NodeStepCache } from '../../step-cache';
import type { Viewport } from '../../types';
import type { EventAccumulator } from '../event-accumulator';

type RunState = {
  steps: TestStep[];
  screenshotPaths: string[];
};

type StepContext = {
  page: Page;
  accumulator: EventAccumulator;
  game: GameEntry;
  viewport: Viewport;
  deviceType: DeviceType;
  runID: string;
  runState: RunState;
  cache: NodeStepCache;
  hints?: RunHints;
};

type StepDescriptor = {
  title: string;
  optional?: boolean;
};

type Step = {
  plan: StepDescriptor[];
  discover: (ctx: StepContext) => Promise<void>;
  execute: (ctx: StepContext) => Promise<void>;
};

export type { RunState, StepContext, Step, StepDescriptor };

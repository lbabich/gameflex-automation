import type { Page } from '@playwright/test';
import type { DeviceType, RunHints, TestStep } from '../../../shared/types';
import type { EventAccumulator } from '../../lib/event-accumulator';
import type { GameEntry } from '../../lib/games';
import type { Viewport } from '../../types';

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

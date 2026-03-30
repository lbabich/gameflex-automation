import type { Page } from '@playwright/test';
import type { DeviceType, PlayMode, TestStep } from '../../../shared/types';
import type { EventAccumulator } from '../../lib/event-accumulator';
import type { GameEntry } from '../../lib/games';
import type { Viewport } from '../../types';

type RunState = {
  steps: TestStep[];
  metadata: Record<string, string>;
  screenshotPaths: string[];
};

type StepContext = {
  page: Page;
  accumulator: EventAccumulator;
  game: GameEntry;
  viewport: Viewport;
  deviceType: DeviceType;
  runID: string;
  playmode: PlayMode;
  runState: RunState;
};

type Step = {
  discover: (ctx: StepContext) => Promise<void>;
  execute: (ctx: StepContext) => Promise<void>;
};

export type { RunState, StepContext, Step };

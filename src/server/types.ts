import type { DeviceType, RunRecord, TestResult } from '../shared/types';

export type InternalTestResult = TestResult & {
  screenshotPaths?: string[];
};

export type InternalRunRecord = Omit<RunRecord, 'results'> & {
  rawOutput?: string;
  results: Partial<Record<DeviceType, InternalTestResult>>;
  logs: string[];
};

export const DEVICE_TYPES = ['desktop', 'mobile'] as const satisfies readonly DeviceType[];

export type Viewport = {
  width: number;
  height: number;
};

export type CachedStep = {
  waitMs: number;
  x: number;
  y: number;
  label: string;
};

export type GameSteps = {
  discoveredAt: string;
  steps: CachedStep[];
  partial?: boolean;
};

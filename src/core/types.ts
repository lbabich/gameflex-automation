import type { DeviceType, RunRecord, TestResult } from '../shared/types';

export type InternalTestResult = Readonly<TestResult> & {
  readonly screenshotPaths?: readonly string[];
};

export type ChildProcessOutput = {
  results: Partial<Record<DeviceType, InternalTestResult>>;
  errors: readonly string[];
};

export type MediaDeviceResult = {
  gif: 'ok' | { error: string };
  cleanup: 'ok' | { error: string };
};

export type MediaResult = Partial<Record<DeviceType, MediaDeviceResult>>;

export type InternalRunRecord = Readonly<Omit<RunRecord, 'results' | 'logs'>> & {
  readonly rawOutput?: string;
  readonly results: Readonly<Partial<Record<DeviceType, InternalTestResult>>>;
  readonly mediaResult?: MediaResult;
  readonly logs: readonly string[];
};

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

export const DEVICE_TYPES = ['desktop', 'mobile'] as const satisfies readonly DeviceType[];

export const SCREENSHOTS_DIR = 'src/core/data/screenshots';
export const RUN_OUTPUTS_DIR = 'src/core/data/run-outputs';

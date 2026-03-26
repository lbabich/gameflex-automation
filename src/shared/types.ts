export type DeviceType = 'desktop' | 'mobile';

export const DEVICE_TYPE = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
} as const satisfies Record<string, DeviceType>;

export type PlayMode = 'demo' | 'real';

export const PLAY_MODE = {
  DEMO: 'demo',
  REAL: 'real',
} as const satisfies Record<string, PlayMode>;

export type RunStatus = 'running' | 'completed' | 'error' | 'cancelled';

export type TestStep = {
  title: string;
  duration: number;
  error?: string;
};

export type TestResult = {
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
  failedStep?: string;
  logs: string[];
  steps?: TestStep[];
  gifUrl?: string;
  screenshotUrls?: string[];
  annotations?: Record<string, string>;
};

export type RunRecord = {
  runID: string;
  gameIDs: string[];
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  results: Partial<Record<DeviceType, TestResult>>;
  playwrightErrors: string[];
};

export type GameEntry = {
  id: string;
  desktopGameID: string;
  mobileGameID?: string;
  name: string;
  gameProviderID: string;
};

export type GameUpdates = {
  name?: string;
  desktopGameID?: string;
  mobileGameID?: string;
  gameProviderID?: string;
};

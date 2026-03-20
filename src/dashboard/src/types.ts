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

export type GameEntry = {
  id: string;
  desktopGameID: string;
  mobileGameID?: string;
  name: string;
  url: string;
  mobileUrl?: string;
  desktopCached?: boolean;
  mobileCached?: boolean;
  desktopEnabled: boolean;
  desktopPlaymode: PlayMode;
  mobileEnabled: boolean;
  mobilePlaymode: PlayMode;
};

export type RunStatus = 'running' | 'completed' | 'error';

export type TestStep = {
  title: string;
  duration: number;
  error?: string;
};

export type TestResult = {
  title: string;
  project: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
  stdout: string[];
  steps?: TestStep[];
  gifUrl?: string;
};

export type RunRecord = {
  runId: string;
  gameIds: string[];
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  results: TestResult[];
  playwrightErrors: string[];
  rawOutput: string;
};

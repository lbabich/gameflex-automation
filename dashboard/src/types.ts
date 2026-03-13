export type GameEntry = {
  gameId: string;
  name: string;
  url: string;
  mobileUrl?: string;
  cached?: boolean;
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

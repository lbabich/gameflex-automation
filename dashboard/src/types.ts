export type GameEntry = {
  gameId: string;
  name: string;
  url: string;
  mobileUrl?: string;
};

export type RunStatus = 'running' | 'passed' | 'failed' | 'error';

export type TestResult = {
  title: string;
  project: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
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

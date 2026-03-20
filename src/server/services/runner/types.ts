export type RunStatus = 'running' | 'completed' | 'error' | 'cancelled';

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
  runID: string;
  gameIDs: string[];
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  results: TestResult[];
  playwrightErrors: string[];
  rawOutput?: string;
};

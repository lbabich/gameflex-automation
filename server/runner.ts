import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { GAMES } from '../tests/games';

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

const runs = new Map<string, RunRecord>();
let activeRunId: string | null = null;

export function getRun(runId: string): RunRecord | undefined {
  return runs.get(runId);
}

export function getRecentRuns(limit = 50): RunRecord[] {
  return [...runs.values()]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type SuiteNode = {
  title?: string;
  suites?: SuiteNode[];
  specs?: SpecNode[];
};

type TestNode = {
  title?: string;
  projectName?: string;
  results?: Array<{
    status?: string;
    duration?: number;
    error?: { message?: string };
  }>;
};

type SpecNode = {
  title?: string;
  tests?: TestNode[];
};

function flattenSpecs(suite: SuiteNode): SpecNode[] {
  const specs: SpecNode[] = [...(suite.specs ?? [])];
  for (const child of suite.suites ?? []) {
    specs.push(...flattenSpecs(child));
  }
  return specs;
}

type ParsedReport = {
  results: TestResult[];
  playwrightErrors: string[];
};

function parseJsonReport(raw: string): ParsedReport {
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) {
    console.error('[runner] No JSON object found in stdout');
    return { results: [], playwrightErrors: [] };
  }

  let report: { suites?: SuiteNode[]; errors?: Array<{ message?: string }> };
  try {
    report = JSON.parse(raw.slice(jsonStart)) as typeof report;
  } catch (err) {
    console.error('[runner] Failed to parse JSON report:', err);
    return { results: [], playwrightErrors: [] };
  }

  const playwrightErrors = (report.errors ?? [])
    .map((e) => e.message ?? '')
    .filter(Boolean);

  if (playwrightErrors.length > 0) {
    console.error('[runner] Playwright top-level errors:', playwrightErrors);
  }

  const results: TestResult[] = [];
  for (const suite of report.suites ?? []) {
    for (const spec of flattenSpecs(suite)) {
      for (const test of spec.tests ?? []) {
        const result = test.results?.[0];
        if (!result) continue;
        const status = result.status as TestResult['status'];
        results.push({
          title: spec.title ?? test.title ?? '(unknown)',
          project: test.projectName ?? '',
          status,
          duration: result.duration ?? 0,
          error: result.error?.message,
        });
      }
    }
  }

  console.log(`[runner] Parsed ${results.length} test result(s), ${playwrightErrors.length} top-level error(s)`);
  return { results, playwrightErrors };
}

export function startRun(gameIds: string[]): { runId: string } | { error: string } {
  if (activeRunId !== null) {
    return { error: 'A run is already in progress' };
  }

  const names = gameIds
    .map((id) => GAMES.find((g) => g.gameId === id)?.name)
    .filter((n): n is string => n !== undefined);

  if (names.length === 0) {
    return { error: 'No valid game IDs provided' };
  }

  const grepPattern = names.map((n) => `spin: ${escapeRegex(n)}`).join('|');
  const runId = randomUUID();
  const record: RunRecord = {
    runId,
    gameIds,
    status: 'running',
    startedAt: new Date().toISOString(),
    results: [],
    playwrightErrors: [],
    rawOutput: '',
  };
  runs.set(runId, record);
  activeRunId = runId;

  // Quote the pattern so the shell treats it as a single argument.
  // Double-quotes are safe on both cmd.exe and sh; escape any literal " inside.
  const quotedPattern = `"${grepPattern.replace(/"/g, '\\"')}"`;
  const cmd = `npx playwright test --reporter=json --grep ${quotedPattern}`;
  console.log(`[runner] Starting run ${runId}`);
  console.log(`[runner] Command: ${cmd}`);

  const child = spawn(cmd, {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, PW_HEADLESS: '1' },
    shell: true,
  });

  const chunks: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));

  child.on('close', (code) => {
    const raw = Buffer.concat(chunks).toString('utf-8');
    console.log(`[runner] Process exited with code ${code}, stdout length: ${raw.length}`);
    const parsed = parseJsonReport(raw);
    record.rawOutput = raw;
    record.results = parsed.results;
    record.playwrightErrors = parsed.playwrightErrors;
    record.finishedAt = new Date().toISOString();
    record.durationMs =
      new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();
    record.status = code === 0 ? 'passed' : 'failed';
    console.log(`[runner] Run ${runId} finished: ${record.status} in ${record.durationMs}ms`);
    activeRunId = null;
  });

  child.on('error', (err) => {
    console.error(`[runner] Spawn error for run ${runId}:`, err);
    record.rawOutput = err.message;
    record.finishedAt = new Date().toISOString();
    record.durationMs =
      new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();
    record.status = 'error';
    activeRunId = null;
  });

  return { runId };
}

import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { GAMES } from '../tests/games';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RunStatus = 'running' | 'passed' | 'failed' | 'error';

export type TestResult = {
  title: string;
  project: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
  stdout: string[];
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

type SuiteNode = {
  title?: string;
  suites?: SuiteNode[];
  specs?: SpecNode[];
};

type SpecNode = {
  title?: string;
  tests?: TestNode[];
};

type TestNode = {
  title?: string;
  projectName?: string;
  results?: Array<{
    status?: string;
    duration?: number;
    error?: { message?: string };
    stdout?: Array<{ text?: string }>;
  }>;
};

type ReportJson = {
  suites?: SuiteNode[];
  errors?: Array<{ message?: string }>;
};

// ─── Run store ────────────────────────────────────────────────────────────────

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

// ─── Report parsing ───────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function flattenSpecs(suite: SuiteNode): SpecNode[] {
  const specs: SpecNode[] = [...(suite.specs ?? [])];
  for (const child of suite.suites ?? []) {
    specs.push(...flattenSpecs(child));
  }
  return specs;
}

function toTestResult(spec: SpecNode, test: TestNode): TestResult | null {
  const result = test.results?.[0];
  if (!result) return null;

  return {
    title: spec.title ?? test.title ?? '(unknown)',
    project: test.projectName ?? '',
    status: result.status as TestResult['status'],
    duration: result.duration ?? 0,
    error: result.error?.message,
    stdout: (result.stdout ?? [])
      .map((e) => e.text ?? '')
      .filter(Boolean)
      .map((t) => t.trimEnd()),
  };
}

function extractReportJson(raw: string): ReportJson | null {
  // dotenv and other tools write to stdout before the JSON blob.
  // The Playwright JSON report always starts with {"config": so we look for that.
  const jsonStart = raw.indexOf('{"config":');
  if (jsonStart === -1) {
    console.error('[runner] Could not find {"config": in stdout. First 300 chars:', raw.slice(0, 300));
    return null;
  }

  try {
    return JSON.parse(raw.slice(jsonStart)) as ReportJson;
  } catch (err) {
    console.error('[runner] Failed to parse JSON report:', err);
    console.error('[runner] Content at parse start:', raw.slice(jsonStart, jsonStart + 200));
    return null;
  }
}

function parseJsonReport(raw: string): { results: TestResult[]; playwrightErrors: string[] } {
  const report = extractReportJson(raw);
  if (!report) return { results: [], playwrightErrors: [] };

  const playwrightErrors = (report.errors ?? []).map((e) => e.message ?? '').filter(Boolean);
  if (playwrightErrors.length > 0) {
    console.error('[runner] Playwright top-level errors:', playwrightErrors);
  }

  const results: TestResult[] = [];
  for (const suite of report.suites ?? []) {
    for (const spec of flattenSpecs(suite)) {
      for (const test of spec.tests ?? []) {
        const result = toTestResult(spec, test);
        if (result) results.push(result);
      }
    }
  }

  console.log(
    `[runner] Parsed ${results.length} test result(s), ${playwrightErrors.length} top-level error(s)`,
  );
  return { results, playwrightErrors };
}

// ─── Process management ───────────────────────────────────────────────────────

function resolveGameNames(gameIds: string[]): string[] {
  return gameIds
    .map((id) => GAMES.find((g) => g.gameId === id)?.name)
    .filter((n): n is string => n !== undefined);
}

function buildPlaywrightCommand(names: string[]): string {
  const grepPattern = names.map((n) => `spin: ${escapeRegex(n)}`).join('|');
  // Quote the pattern so the shell treats it as a single argument.
  // Double-quotes are safe on both cmd.exe and sh; escape any literal " inside.
  const quotedPattern = `"${grepPattern.replace(/"/g, '\\"')}"`;
  return `npx playwright test --reporter=json --grep ${quotedPattern}`;
}

function createRunRecord(runId: string, gameIds: string[]): RunRecord {
  return {
    runId,
    gameIds,
    status: 'running',
    startedAt: new Date().toISOString(),
    results: [],
    playwrightErrors: [],
    rawOutput: '',
  };
}

function finalizeRecord(record: RunRecord, code: number | null, raw: string): void {
  const parsed = parseJsonReport(raw);
  record.rawOutput = raw;
  record.results = parsed.results;
  record.playwrightErrors = parsed.playwrightErrors;
  record.finishedAt = new Date().toISOString();
  record.durationMs = new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();
  record.status = code === 0 ? 'passed' : 'failed';
}

function attachProcessHandlers(child: ChildProcess, record: RunRecord): void {
  const chunks: Buffer[] = [];
  child.stdout!.on('data', (chunk: Buffer) => chunks.push(chunk));

  let stderrBuf = '';
  child.stderr!.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString('utf-8');
    const lines = stderrBuf.split('\n');
    stderrBuf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) console.log(`[playwright] ${line}`);
    }
  });

  child.on('close', (code) => {
    if (stderrBuf.trim()) console.log(`[playwright] ${stderrBuf}`);
    const raw = Buffer.concat(chunks).toString('utf-8');
    console.log(`[runner] Process exited with code ${code}, stdout length: ${raw.length}`);
    finalizeRecord(record, code, raw);
    console.log(`[runner] Run ${record.runId} finished: ${record.status} in ${record.durationMs}ms`);
    activeRunId = null;
  });

  child.on('error', (err) => {
    console.error(`[runner] Spawn error for run ${record.runId}:`, err);
    record.rawOutput = err.message;
    record.finishedAt = new Date().toISOString();
    record.durationMs = new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();
    record.status = 'error';
    activeRunId = null;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startRun(gameIds: string[]): { runId: string } | { error: string } {
  if (activeRunId !== null) {
    return { error: 'A run is already in progress' };
  }

  const names = resolveGameNames(gameIds);
  if (names.length === 0) {
    return { error: 'No valid game IDs provided' };
  }

  const runId = randomUUID();
  const record = createRunRecord(runId, gameIds);
  runs.set(runId, record);
  activeRunId = runId;

  const cmd = buildPlaywrightCommand(names);
  console.log(`[runner] Starting run ${runId}`);
  console.log(`[runner] Command: ${cmd}`);

  const child = spawn(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PW_HEADLESS: '1' },
    shell: true,
  });

  attachProcessHandlers(child, record);

  return { runId };
}

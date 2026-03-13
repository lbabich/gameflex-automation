import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readGames } from './games';

export type RunStatus = 'running' | 'completed' | 'error';

type StepNode = {
  title?: string;
  duration?: number;
  error?: { message?: string };
  steps?: StepNode[];
};

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
    steps?: StepNode[];
  }>;
};

type ReportJson = {
  suites?: SuiteNode[];
  errors?: Array<{ message?: string }>;
};

const runs = new Map<string, RunRecord>();
const activeRunsByGame = new Map<string, string>();
const activeProcessesByRunId = new Map<string, ChildProcess>();
const lastRunIdByGame = new Map<string, string>();
let headless = process.env.PW_HEADLESS !== '0';

export function getHeadless(): boolean {
  return headless;
}

export function setHeadless(v: boolean): void {
  headless = v;
}

export function getRun(runId: string): RunRecord | undefined {
  return runs.get(runId);
}

export function getRecentRuns(limit = 50): RunRecord[] {
  return [...runs.values()]
    .sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    })
    .slice(0, limit);
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

  if (!result) {
    return null;
  }

  return {
    title: spec.title ?? test.title ?? '(unknown)',
    project: test.projectName ?? '',
    status: result.status as TestResult['status'],
    duration: result.duration ?? 0,
    error: result.error?.message,
    stdout: (result.stdout ?? [])
      .map((e) => {
        return e.text ?? '';
      })
      .filter(Boolean)
      .map((t) => {
        return t.trimEnd();
      }),
    steps: (result.steps ?? [])
      .map((s) => {
        return {
          title: s.title ?? '',
          duration: s.duration ?? 0,
          error: s.error?.message,
        };
      })
      .filter((s) => {
        return s.title;
      }),
  };
}

function extractReportJson(raw: string): ReportJson | null {
  // Playwright pretty-prints its JSON output so the report object opens on its
  // own line: "\n{\n  \"config\":...". Search for a '{' at the start of a line.
  // Fall back to a compact-JSON search, then to the first '{' as a last resort.
  const newlineIdx = raw.indexOf('\n{');

  let jsonStart: number;

  if (newlineIdx !== -1) {
    jsonStart = newlineIdx + 1;
  } else if (raw.includes('{"config":')) {
    jsonStart = raw.indexOf('{"config":');
  } else {
    jsonStart = raw.indexOf('{');
  }

  if (jsonStart === -1) {
    console.error('[runner] Could not find JSON in stdout. First 300 chars:', raw.slice(0, 300));
    return null;
  }

  console.log(
    `[runner] JSON start at index ${jsonStart}, first 60 chars: ${JSON.stringify(raw.slice(jsonStart, jsonStart + 60))}`,
  );

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

  if (!report) {
    return { results: [], playwrightErrors: [] };
  }

  const playwrightErrors = (report.errors ?? [])
    .map((e) => {
      return e.message ?? '';
    })
    .filter(Boolean);

  if (playwrightErrors.length > 0) {
    console.error('[runner] Playwright top-level errors:', playwrightErrors);
  }

  console.log(`[runner] Suites found: ${report.suites?.length ?? 0}`);

  const results: TestResult[] = [];

  for (const suite of report.suites ?? []) {
    const specs = flattenSpecs(suite);
    console.log(`[runner] Suite "${suite.title}" → ${specs.length} spec(s)`);
    for (const spec of specs) {
      for (const test of spec.tests ?? []) {
        const result = toTestResult(spec, test);
        if (result) {
          results.push(result);
        }
      }
    }
  }

  console.log(
    `[runner] Parsed ${results.length} test result(s), ${playwrightErrors.length} top-level error(s)`,
  );
  return { results, playwrightErrors };
}

function resolveGameNames(gameIds: string[]): string[] {
  const games = readGames();
  return gameIds
    .map((id) => {
      return games.find((g) => {
        return g.gameId === id;
      })?.name;
    })
    .filter((n): n is string => {
      return n !== undefined;
    });
}

function buildPlaywrightCommand(names: string[]): string {
  const grepPattern = names
    .map((n) => {
      return `spin: ${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    })
    .join('|');
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
  record.status = code === 0 ? 'completed' : 'error';

  const games = readGames();

  for (const result of record.results) {
    const game = games.find((g) => {
      return result.title === `spin: ${g.name}` || result.title.startsWith(`spin: ${g.name} `);
    });

    if (game) {
      const gifPath = path.resolve('screenshots', game.gameId, 'animated.gif');

      if (fs.existsSync(gifPath)) {
        result.gifUrl = `/api/screenshots/${game.gameId}/animated.gif`;
      }
    }
  }
}

function attachProcessHandlers(child: ChildProcess, record: RunRecord): void {
  activeProcessesByRunId.set(record.runId, child);

  const chunks: Buffer[] = [];

  child.stdout?.on('data', (chunk: Buffer) => {
    return chunks.push(chunk);
  });

  let stderrBuf = '';

  child.stderr?.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString('utf-8');
    const lines = stderrBuf.split('\n');
    stderrBuf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) {
        console.log(`[playwright] ${line}`);
      }
    }
  });

  child.on('close', (code) => {
    if (stderrBuf.trim()) {
      console.log(`[playwright] ${stderrBuf}`);
    }

    const raw = Buffer.concat(chunks).toString('utf-8');

    finalizeRecord(record, code, raw);

    let passed = 0,
      failed = 0,
      skipped = 0;

    for (const r of record.results) {
      if (r.status === 'passed') {
        passed++;
      } else if (r.status === 'failed') {
        failed++;
      } else if (r.status === 'skipped') {
        skipped++;
      }
    }

    console.log(
      `[runner] Run ${record.runId} finished in ${record.durationMs}ms — ${passed} passed, ${failed} failed, ${skipped} skipped`,
    );

    if (runs.size > 100) {
      const oldest = [...runs.entries()]
        .sort(([, a], [, b]) => {
          return a.startedAt < b.startedAt ? -1 : 1;
        })
        .slice(0, runs.size - 100);
      for (const [id] of oldest) {
        runs.delete(id);
      }
    }

    activeProcessesByRunId.delete(record.runId);

    for (const id of record.gameIds) {
      activeRunsByGame.delete(id);
    }
  });

  child.on('error', (err) => {
    console.error(`[runner] Spawn error for run ${record.runId}:`, err);
    record.rawOutput = err.message;
    record.finishedAt = new Date().toISOString();
    record.durationMs =
      new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();
    record.status = 'error';

    activeProcessesByRunId.delete(record.runId);

    for (const id of record.gameIds) {
      activeRunsByGame.delete(id);
    }
  });
}

export function startRun(gameIds: string[]): { runId: string } | { error: string } {
  const conflicting = gameIds.filter((id) => {
    return activeRunsByGame.has(id);
  });

  if (conflicting.length > 0) {
    return { error: `Game(s) already running: ${conflicting.join(', ')}` };
  }

  const names = resolveGameNames(gameIds);

  if (names.length === 0) {
    return { error: 'No valid game IDs provided' };
  }

  const oldRunIds = new Set(
    gameIds
      .map((id) => {
        return lastRunIdByGame.get(id);
      })
      .filter(Boolean) as string[],
  );

  for (const oldId of oldRunIds) {
    const old = runs.get(oldId);

    if (old && old.status !== 'running') {
      runs.delete(oldId);
    }
  }

  const runId = randomUUID();
  const record = createRunRecord(runId, gameIds);

  runs.set(runId, record);

  for (const id of gameIds) {
    activeRunsByGame.set(id, runId);
  }

  for (const id of gameIds) {
    lastRunIdByGame.set(id, runId);
  }

  const cmd = buildPlaywrightCommand(names);

  console.log(`[runner] Starting run ${runId}`);
  console.log(`[runner] Command: ${cmd}`);

  const child = spawn(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PW_HEADLESS: headless ? '1' : '0' },
    shell: true,
  });

  attachProcessHandlers(child, record);

  return { runId };
}

export function cancelRun(runId: string): boolean {
  const child = activeProcessesByRunId.get(runId);

  if (!child?.pid) {
    return false;
  }

  try {
    execSync(`taskkill /F /T /PID ${child.pid}`);
  } catch {
    child.kill();
  }

  return true;
}

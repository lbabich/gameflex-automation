import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readGames } from '../lib/games';
import { ANIMATED_GIF_FILENAME } from '../lib/gif-generator';
import type { DeviceType } from '../lib/types';
import { DEVICE_TYPE } from '../lib/types';
import { parseJsonReport } from './report-parser';

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

const RUNS_FILE = path.resolve('src/data/runs.json');

const runs = new Map<string, RunRecord>();

function loadRuns(): void {
  if (!fs.existsSync(RUNS_FILE)) {
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(RUNS_FILE, 'utf-8')) as RunRecord[];

    for (const run of data) {
      runs.set(run.runID, run);
    }
  } catch {
    // ignore corrupt file
  }
}

loadRuns();
const activeRunsByGame = new Map<string, string>();
const activeProcessesByRunId = new Map<string, ChildProcess>();

export function getRun(runID: string): RunRecord | undefined {
  return runs.get(runID);
}

export function getRecentRuns(limit = 50): RunRecord[] {
  return [...runs.values()]
    .sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    })
    .slice(0, limit);
}

function resolveGameNames(gameIDs: string[]): string[] {
  const games = readGames();

  return gameIDs
    .map((id) => {
      return games.find((g) => {
        return g.id === id;
      })?.name;
    })
    .filter((n): n is string => {
      return n !== undefined;
    });
}

function buildPlaywrightCommand(names: string[], projects?: string[]): string {
  const grepPattern = names
    .map((n) => {
      return `spin: ${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    })
    .join('|');
  // Quote the pattern so the shell treats it as a single argument.
  // Double-quotes are safe on both cmd.exe and sh; escape any literal " inside.
  const quotedPattern = `"${grepPattern.replace(/"/g, '\\"')}"`;

  const projectFlags = projects?.length
    ? projects
        .map((p) => {
          return `--project ${p}`;
        })
        .join(' ')
    : '';

  return `npx playwright test --reporter=json --grep ${quotedPattern}${projectFlags ? ` ${projectFlags}` : ''}`;
}

function createRunRecord(runID: string, gameIDs: string[]): RunRecord {
  return {
    runID,
    gameIDs,
    status: 'running',
    startedAt: new Date().toISOString(),
    results: [],
    playwrightErrors: [],
    rawOutput: '',
  };
}

function saveRuns(): void {
  const completed = [...runs.values()].filter((r) => {
    return r.status !== 'running';
  });
  const toSave = completed
    .sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    })
    .slice(0, 100)
    .map(({ rawOutput: _raw, ...rest }) => {
      return rest;
    });

  fs.writeFileSync(RUNS_FILE, JSON.stringify(toSave, null, 2));
}

function finalizeRecord(record: RunRecord, code: number | null, raw: string): void {
  record.rawOutput = raw;
  record.finishedAt = new Date().toISOString();
  record.durationMs = new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();

  if (record.status !== 'cancelled') {
    const parsed = parseJsonReport(raw);

    record.results = parsed.results;
    record.playwrightErrors = parsed.playwrightErrors;
    record.status = code === 0 ? 'completed' : 'error';
  }

  const games = readGames();

  for (const result of record.results) {
    const game = games.find((g) => {
      return result.title === `spin: ${g.name}` || result.title.startsWith(`spin: ${g.name} `);
    });

    if (game) {
      const deviceType: DeviceType = /mobile/i.test(result.project)
        ? DEVICE_TYPE.MOBILE
        : DEVICE_TYPE.DESKTOP;
      const gifPath = path.resolve(
        'src/server/screenshots',
        game.id,
        deviceType,
        ANIMATED_GIF_FILENAME,
      );

      if (fs.existsSync(gifPath)) {
        result.gifUrl = `/api/screenshots/${game.id}/${deviceType}/${ANIMATED_GIF_FILENAME}`;
      }
    }
  }

  saveRuns();
}

function attachProcessHandlers(child: ChildProcess, record: RunRecord): void {
  activeProcessesByRunId.set(record.runID, child);

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

    let passed = 0;
    let failed = 0;
    let skipped = 0;

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
      `[runner] Run ${record.runID} finished in ${record.durationMs}ms — ${passed} passed, ${failed} failed, ${skipped} skipped`,
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

    activeProcessesByRunId.delete(record.runID);

    for (const id of record.gameIDs) {
      activeRunsByGame.delete(id);
    }
  });

  child.on('error', (err) => {
    console.error(`[runner] Spawn error for run ${record.runID}:`, err);
    record.rawOutput = err.message;
    record.finishedAt = new Date().toISOString();
    record.durationMs =
      new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();
    record.status = 'error';

    activeProcessesByRunId.delete(record.runID);

    for (const id of record.gameIDs) {
      activeRunsByGame.delete(id);
    }
  });
}

export function startRun(
  gameIDs: string[],
  projects?: string[],
): { runID: string } | { error: string } {
  const conflicting = gameIDs.filter((id) => {
    return activeRunsByGame.has(id);
  });

  if (conflicting.length > 0) {
    return { error: `Game(s) already running: ${conflicting.join(', ')}` };
  }

  const names = resolveGameNames(gameIDs);

  if (names.length === 0) {
    return { error: 'No valid game IDs provided' };
  }

  const runID = randomUUID();
  const record = createRunRecord(runID, gameIDs);

  runs.set(runID, record);

  for (const id of gameIDs) {
    activeRunsByGame.set(id, runID);
  }

  const cmd = buildPlaywrightCommand(names, projects);

  console.log(`[runner] Starting run ${runID}`);
  console.log(`[runner] Command: ${cmd}`);

  const child = spawn(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  attachProcessHandlers(child, record);

  return { runID };
}

export function cancelRun(runID: string): boolean {
  const child = activeProcessesByRunId.get(runID);

  if (!child?.pid) {
    return false;
  }

  const record = runs.get(runID);

  if (record) {
    record.status = 'cancelled';
  }

  try {
    execSync(`taskkill /F /T /PID ${child.pid}`);
  } catch {
    child.kill();
  }

  return true;
}

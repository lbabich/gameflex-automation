import * as path from 'node:path';
import { Effect, type Fiber } from 'effect';
import * as games from '../../../lib/games';
import * as gifGenerator from '../../../lib/gif-generator';
import * as libTypes from '../../../lib/types';
import { parseJsonReport } from '../../report-parser';
import { FileService } from '../file';
import type { RunRecord, TestResult } from './types';

export const RUNS_FILE = path.resolve('src/data/runs.json');

export type RunnerState = {
  runs: Map<string, RunRecord>;
  activeRunsByGame: Map<string, string>;
  activeFibers: Map<string, Fiber.RuntimeFiber<void, never>>;
};

function attachGifUrls(results: TestResult[]) {
  return Effect.gen(function* () {
    const fileService = yield* FileService;
    const gameList = games.readGames();

    for (const result of results) {
      const game = gameList.find((g) => {
        return result.title === `spin: ${g.name}` || result.title.startsWith(`spin: ${g.name} `);
      });

      if (game) {
        const deviceType: libTypes.DeviceType = /mobile/i.test(result.project)
          ? libTypes.DEVICE_TYPE.MOBILE
          : libTypes.DEVICE_TYPE.DESKTOP;

        const gifPath = path.resolve(
          'src/server/screenshots',
          game.id,
          deviceType,
          gifGenerator.ANIMATED_GIF_FILENAME,
        );

        const gifExists = yield* fileService.exists(gifPath);

        if (gifExists) {
          result.gifUrl = `/api/screenshots/${game.id}/${deviceType}/${gifGenerator.ANIMATED_GIF_FILENAME}`;
        }
      }
    }
  });
}

function logSummary(record: RunRecord): void {
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
    `[runner] Run ${record.runId} finished in ${record.durationMs}ms — ${passed} passed, ${failed} failed, ${skipped} skipped`,
  );
}

function trimMemory(runs: Map<string, RunRecord>): void {
  if (runs.size <= 100) {
    return;
  }

  const oldest = [...runs.entries()]
    .sort(([, a], [, b]) => {
      return a.startedAt < b.startedAt ? -1 : 1;
    })
    .slice(0, runs.size - 100);

  for (const [id] of oldest) {
    runs.delete(id);
  }
}

export function saveRuns(state: RunnerState) {
  return Effect.gen(function* () {
    const fileService = yield* FileService;

    const completed = [...state.runs.values()].filter((r) => {
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

    yield* fileService.write(RUNS_FILE, JSON.stringify(toSave, null, 2));
  });
}

export function finalizeRun(state: RunnerState, record: RunRecord, code: number, raw: string) {
  return Effect.gen(function* () {
    record.rawOutput = raw;
    record.finishedAt = new Date().toISOString();
    record.durationMs =
      new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();

    if (record.status !== 'cancelled') {
      const parsed = parseJsonReport(raw);

      record.results = parsed.results;
      record.playwrightErrors = parsed.playwrightErrors;
      record.status = code === 0 ? 'completed' : 'error';
    }

    yield* attachGifUrls(record.results);

    yield* saveRuns(state).pipe(
      Effect.catchAll((err) => {
        console.error('[runner] Failed to persist run:', err);

        return Effect.succeed(undefined);
      }),
    );

    logSummary(record);
    trimMemory(state.runs);

    state.activeFibers.delete(record.runId);

    for (const id of record.gameIds) {
      state.activeRunsByGame.delete(id);
    }
  });
}

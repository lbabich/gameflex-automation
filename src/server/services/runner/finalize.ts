import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect, type Fiber } from 'effect';
import * as games from '../../../lib/games';
import * as gifGenerator from '../../../lib/gif-generator';
import * as libTypes from '../../../lib/types';
import { parseJsonReport } from '../../report-parser';
import { FileService } from '../file.service';
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
      const game = gameList.find((entry) => {
        return (
          result.title === `spin: ${entry.name}` || result.title.startsWith(`spin: ${entry.name} `)
        );
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

function logSummary(record: RunRecord) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const result of record.results) {
    if (result.status === 'passed') {
      passed++;
    } else if (result.status === 'failed') {
      failed++;
    } else if (result.status === 'skipped') {
      skipped++;
    }
  }

  console.log(
    `[runner] Run ${record.runID} finished in ${record.durationMs}ms — ${passed} passed, ${failed} failed, ${skipped} skipped`,
  );
}

function trimMemory(runs: Map<string, RunRecord>) {
  if (runs.size <= 10) {
    return;
  }

  const oldest = [...runs.entries()]
    .sort(([, a], [, b]) => {
      return a.startedAt < b.startedAt ? -1 : 1;
    })
    .slice(0, runs.size - 10);

  for (const [id] of oldest) {
    runs.delete(id);
  }
}

export function saveRuns(state: RunnerState) {
  return Effect.gen(function* () {
    const fileService = yield* FileService;

    const completed = [...state.runs.values()].filter((run) => {
      return run.status !== 'running';
    });

    const toSave = completed
      .sort((a, b) => {
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      })
      .slice(0, 10)
      .map(({ rawOutput: _raw, ...rest }) => {
        return rest;
      });

    yield* fileService.write(RUNS_FILE, JSON.stringify(toSave, null, 2));
  }).pipe(
    Effect.catchAll((error) => {
      console.error('[runner] Failed to save runs:', error);

      return Effect.succeed(undefined);
    }),
  );
}

function attachScreenshotUrls(runID: string, results: TestResult[]) {
  return Effect.sync(() => {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const paths = result.screenshotPaths;

      result.screenshotPaths = undefined;

      if (!paths?.length) {
        continue;
      }

      const destDir = path.resolve('src/server/screenshots', runID, 'failure');

      try {
        fs.mkdirSync(destDir, { recursive: true });
      } catch {
        continue;
      }

      const urls: string[] = [];

      for (let j = 0; j < paths.length; j++) {
        const srcPath = paths[j];
        const filename = `${i}-${j}${path.extname(srcPath)}`;
        const destPath = path.join(destDir, filename);

        try {
          fs.copyFileSync(srcPath, destPath);
          urls.push(`/api/screenshots/${runID}/failure/${filename}`);
        } catch (err) {
          console.warn('[runner] Failed to copy failure screenshot:', err);
        }
      }

      result.screenshotUrls = urls;
    }
  });
}

export function finalizeRun(state: RunnerState, record: RunRecord, code: number, stdout: string) {
  return Effect.gen(function* () {
    record.rawOutput = stdout;
    record.finishedAt = new Date().toISOString();
    record.durationMs =
      new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();

    if (record.status !== 'cancelled') {
      const parsed = yield* parseJsonReport(stdout);

      record.results = parsed.results;
      record.playwrightErrors = parsed.playwrightErrors;
      record.status = code === 0 ? 'completed' : 'error';
    }

    yield* attachGifUrls(record.results);
    yield* attachScreenshotUrls(record.runID, record.results);

    yield* saveRuns(state);

    logSummary(record);
    trimMemory(state.runs);

    state.activeFibers.delete(record.runID);

    for (const id of record.gameIDs) {
      state.activeRunsByGame.delete(id);
    }
  });
}

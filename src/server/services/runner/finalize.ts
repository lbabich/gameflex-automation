import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect, type Fiber } from 'effect';
import * as gifGenerator from '../../../lib/gif-generator';
import * as libTypes from '../../../lib/types';
import { FileService } from '../file.service';
import type { RunRecord, TestResult } from './types';

export const RUNS_FILE = path.resolve('src/data/runs.json');

export type RunnerState = {
  runs: Map<string, RunRecord>;
  activeRunsByGame: Map<string, string>;
  activeFibers: Map<string, Fiber.RuntimeFiber<void, never>>;
};

function finalizeRun(state: RunnerState, record: RunRecord, code: number, stdout: string) {
  return Effect.gen(function* () {
    record.rawOutput = stdout;
    record.finishedAt = new Date().toISOString();
    record.durationMs =
      new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();

    if (record.status !== 'cancelled') {
      const parsed = yield* parseSpinOutput(stdout);

      record.results = parsed.results;
      record.playwrightErrors = parsed.errors;
      record.status = code === 0 ? 'completed' : 'error';
    }

    // Step 1: record failure screenshot URL (last one only)
    yield* attachScreenshotUrls(record.results);

    // Step 2: generate GIF from non-failure PNGs, which deletes them
    yield* attachGifUrls(record.runID, record.results);

    // Step 3: delete extra failure screenshots, keeping only the last
    yield* cleanupImages(record.results);

    yield* saveRuns(state);

    logSummary(record);
    trimMemory(state.runs);

    state.activeFibers.delete(record.runID);

    for (const id of record.gameIDs) {
      state.activeRunsByGame.delete(id);
    }
  });
}

function saveRuns(state: RunnerState) {
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

function attachScreenshotUrls(results: TestResult[]) {
  return Effect.sync(() => {
    const screenshotsBase = path.resolve('src/server/screenshots');

    for (const result of results) {
      const paths = result.screenshotPaths;

      if (!paths?.length) {
        continue;
      }

      const lastPath = paths[paths.length - 1];
      const relativePath = path.relative(screenshotsBase, lastPath).replace(/\\/g, '/');

      result.screenshotUrls = [`/api/screenshots/${relativePath}`];
    }
  });
}

function attachGifUrls(runID: string, results: TestResult[]) {
  return Effect.gen(function* () {
    for (const result of results) {
      const deviceType: libTypes.DeviceType = /mobile/i.test(result.project)
        ? libTypes.DEVICE_TYPE.MOBILE
        : libTypes.DEVICE_TYPE.DESKTOP;

      yield* Effect.tryPromise({
        try: () => {
          return gifGenerator.generateGif(runID, deviceType);
        },
        catch: (err) => {
          return err;
        },
      }).pipe(
        Effect.tap(() => {
          return Effect.sync(() => {
            result.gifUrl = `/api/screenshots/${runID}/${deviceType}/${gifGenerator.ANIMATED_GIF_FILENAME}`;
          });
        }),
        Effect.catchAll((err) => {
          return Effect.sync(() => {
            console.warn('[runner] Failed to generate GIF:', err);
          });
        }),
      );
    }
  });
}

function cleanupImages(results: TestResult[]) {
  return Effect.sync(() => {
    for (const result of results) {
      const paths = result.screenshotPaths;

      result.screenshotPaths = undefined;

      if (!paths || paths.length <= 1) {
        continue;
      }

      for (let i = 0; i < paths.length - 1; i++) {
        try {
          fs.unlinkSync(paths[i]);
        } catch (err) {
          console.warn('[runner] Failed to delete failure screenshot:', err);
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

function parseSpinOutput(stdout: string) {
  return Effect.sync(() => {
    try {
      const jsonStart = stdout.indexOf('{"results":');

      if (jsonStart === -1) {
        throw new Error('No JSON output found in stdout');
      }

      const parsed = JSON.parse(stdout.slice(jsonStart)) as {
        results: TestResult[];
        errors: string[];
      };

      console.log(
        `[runner] Parsed ${parsed.results.length} result(s), ${parsed.errors.length} error(s)`,
      );

      return { results: parsed.results, errors: parsed.errors };
    } catch (error) {
      console.error('[runner] Failed to parse spin output:', error);
      console.error('[runner] stdout snippet:', stdout.slice(0, 200));

      return { results: [] as TestResult[], errors: [] as string[] };
    }
  });
}

export { saveRuns, finalizeRun };

import { randomUUID } from 'node:crypto';
import { Effect, Fiber, Layer } from 'effect';
import type { DeviceType, RunHints, RunRecord, TestResult } from '../../../shared/types';
import { GameNotFoundError, RunAlreadyActiveError, RunNotFoundError } from '../../errors';
import type { GameEntry } from '../../lib/games';
import type { InternalRunRecord } from '../../types';
import { FileService } from '../file.service';
import { GamesService } from '../games.service';
import { buildSpinCommand } from './command';
import { attachGifUrls, attachScreenshotUrls, cleanupImages } from './media';
import { parseSpinOutput } from './output-parser';
import { loadRuns, saveRuns, trimMemory } from './persistence';
import { spawnProcess } from './process';
import { RunLoggerService } from './run-logger.service';
import { RunStateService } from './run-state.service';

type RunnerState = {
  runs: Map<string, InternalRunRecord>;
  activeRunsByGame: Map<string, string>;
  activeFibers: Map<string, Fiber.RuntimeFiber<void, never>>;
};

class RunnerService extends Effect.Tag('RunnerService')<
  RunnerService,
  {
    startRun: (
      gameIDs: string[],
      deviceTypes: string[],
      playmode: string,
      steps?: string[],
      hints?: RunHints,
    ) => Effect.Effect<RunRecord, RunAlreadyActiveError | GameNotFoundError>;
    cancelRun: (runID: string) => Effect.Effect<void, RunNotFoundError>;
    getRun: (runID: string) => Effect.Effect<RunRecord, RunNotFoundError>;
    getRecentRuns: (limit?: number) => Effect.Effect<RunRecord[]>;
    clearGameRuns: (gameID: string) => Effect.Effect<void>;
  }
>() {}

export const NodeRunnerService = Layer.effect(
  RunnerService,
  Effect.gen(function* () {
    const state = yield* RunStateService;
    const runLoggerService = yield* RunLoggerService;
    const fileService = yield* FileService;
    const gamesService = yield* GamesService;

    const loadedRuns = yield* loadRuns();

    for (const run of loadedRuns) {
      state.runs.set(run.runID, run);
    }

    return {
      startRun: (
        gameIDs: string[],
        deviceTypes: string[],
        playmode: string,
        steps?: string[],
        hints?: RunHints,
      ) => {
        return startRun(
          state,
          gamesService,
          fileService,
          runLoggerService,
          gameIDs,
          deviceTypes,
          playmode,
          steps,
          hints,
        );
      },
      cancelRun: (runID: string) => {
        return cancelRun(state, fileService, runLoggerService, runID);
      },
      getRun: (runID: string) => {
        return getRun(state, runID);
      },
      getRecentRuns: (limit?: number) => {
        return getRecentRuns(state, limit);
      },
      clearGameRuns: (gameID: string) => {
        return clearGameRuns(state, fileService, gameID);
      },
    };
  }),
);

function startRun(
  state: RunnerState,
  gamesService: GamesService['Type'],
  fileService: FileService['Type'],
  runLoggerService: RunLoggerService['Type'],
  gameIDs: string[],
  deviceTypes: string[],
  playmode: string,
  steps?: string[],
  hints?: RunHints,
) {
  return Effect.gen(function* () {
    const conflicting = gameIDs.filter((id: string) => {
      return state.activeRunsByGame.has(id);
    });

    if (conflicting.length > 0) {
      return yield* Effect.fail(new RunAlreadyActiveError({ gameID: conflicting[0] ?? '' }));
    }

    const gameList = yield* gamesService.list();
    const firstMissingID = gameIDs.find((id: string) => {
      return !gameList.some((game: GameEntry) => {
        return game.id === id;
      });
    });

    if (firstMissingID !== undefined) {
      return yield* Effect.fail(new GameNotFoundError({ id: firstMissingID }));
    }

    const runID = randomUUID();
    const record = createRecord(runID, gameIDs);

    state.runs.set(runID, record);

    for (const id of gameIDs) {
      state.activeRunsByGame.set(id, runID);
    }

    const cmd = buildSpinCommand(runID, gameIDs, deviceTypes, playmode, steps, hints);

    yield* runLoggerService.log(runID, 'runner', `Starting run ${runID}`);
    yield* runLoggerService.log(runID, 'runner', `Command: ${cmd}`);

    const background = Effect.gen(function* () {
      yield* runLoggerService.log(runID, 'runner', 'Spawning playwright process');

      const { code, stdout } = yield* spawnProcess(cmd);

      yield* runLoggerService.log(runID, 'runner', `Process exited with code ${code}`);

      yield* finalizeRun(state, runLoggerService, fileService, runID, code, stdout);
    }).pipe(
      Effect.catchAll((error: never) => {
        return handleFiberError(state, runLoggerService, runID, error);
      }),
    );

    const fiber = yield* Effect.forkDaemon(background);

    state.activeFibers.set(runID, fiber);

    return record as RunRecord;
  });
}

function cancelRun(
  state: RunnerState,
  fileService: FileService['Type'],
  runLoggerService: RunLoggerService['Type'],
  runID: string,
) {
  return Effect.gen(function* () {
    const fiber = state.activeFibers.get(runID);
    const record = state.runs.get(runID);

    if (!fiber || !record) {
      return yield* Effect.fail(new RunNotFoundError({ runID }));
    }

    record.status = 'cancelled';
    record.finishedAt = new Date().toISOString();
    record.durationMs =
      new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();

    yield* Fiber.interrupt(fiber);

    state.activeFibers.delete(runID);

    for (const id of record.gameIDs) {
      state.activeRunsByGame.delete(id);
    }

    yield* saveRuns(fileService, state.runs).pipe(
      Effect.tapError((err) => {
        return runLoggerService.error(runID, 'runner', 'Failed to save runs', err);
      }),
      Effect.orElse(() => {
        return Effect.succeed(undefined);
      }),
    );
  });
}

function getRun(state: RunnerState, runID: string) {
  return Effect.gen(function* () {
    const record = state.runs.get(runID);

    if (!record) {
      return yield* Effect.fail(new RunNotFoundError({ runID }));
    }

    return record;
  });
}

function getRecentRuns(state: RunnerState, limit = 10) {
  return Effect.sync(() => {
    return [...state.runs.values()]
      .sort((runA: RunRecord, runB: RunRecord) => {
        return new Date(runB.startedAt).getTime() - new Date(runA.startedAt).getTime();
      })
      .slice(0, limit);
  });
}

function handleFiberError(
  state: RunnerState,
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  error: unknown,
) {
  return Effect.gen(function* () {
    yield* runLoggerService.error(runID, 'runner', 'Background fiber error:', error);

    const run = state.runs.get(runID);

    if (run?.status === 'running') {
      const finishedAt = new Date().toISOString();

      state.runs.set(runID, {
        ...run,
        status: 'error',
        finishedAt,
        durationMs: new Date(finishedAt).getTime() - new Date(run.startedAt).getTime(),
      });
    }

    state.activeFibers.delete(runID);

    for (const id of run?.gameIDs ?? []) {
      state.activeRunsByGame.delete(id);
    }
  });
}

function finalizeRun(
  state: RunnerState,
  runLoggerService: RunLoggerService['Type'],
  fileService: FileService['Type'],
  runID: string,
  code: number,
  stdout: string,
) {
  return Effect.gen(function* () {
    const record = state.runs.get(runID);

    if (!record) {
      return;
    }

    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(record.startedAt).getTime();

    let updated: InternalRunRecord = {
      ...record,
      rawOutput: stdout,
      finishedAt,
      durationMs,
    };

    if (record.status !== 'cancelled') {
      yield* runLoggerService.log(runID, 'finalize', `parsing output for run ${runID}`);

      const emptyResult = {
        results: {} as Partial<Record<DeviceType, TestResult>>,
        errors: [] as string[],
      };

      const parsed = yield* parseSpinOutput(stdout).pipe(
        Effect.tapError((error) => {
          return runLoggerService.error(runID, 'finalize', 'Failed to parse spin output', error);
        }),
        Effect.tapError(() => {
          return runLoggerService.error(
            runID,
            'finalize',
            `stdout snippet: ${stdout.slice(0, 200)}`,
          );
        }),
        Effect.orElse(() => {
          return Effect.succeed(emptyResult);
        }),
      );

      yield* runLoggerService.log(
        runID,
        'finalize',
        `${Object.keys(parsed.results).length} result(s), ${parsed.errors.length} error(s)`,
      );

      updated = {
        ...updated,
        results: parsed.results,
        playwrightErrors: parsed.errors,
        status: code === 0 ? 'completed' : 'error',
      };
    }

    yield* attachScreenshotUrls(updated.results);
    yield* attachGifUrls(runLoggerService, runID, updated.results);
    yield* cleanupImages(runLoggerService, runID, updated.results);

    state.runs.set(runID, updated);

    yield* saveRuns(fileService, state.runs).pipe(
      Effect.tapError((err) => {
        return runLoggerService.error(runID, 'runner', 'Failed to save runs', err);
      }),
      Effect.orElse(() => {
        return Effect.succeed(undefined);
      }),
    );

    yield* logSummary(runLoggerService, updated);
    trimMemory(state.runs);

    state.activeFibers.delete(runID);

    for (const id of updated.gameIDs) {
      state.activeRunsByGame.delete(id);
    }
  });
}

function logSummary(runLoggerService: RunLoggerService['Type'], record: InternalRunRecord) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const result of Object.values(record.results)) {
    if (result?.status === 'passed') {
      passed++;
    } else if (result?.status === 'failed') {
      failed++;
    } else if (result?.status === 'skipped') {
      skipped++;
    }
  }

  return runLoggerService.log(
    record.runID,
    'runner',
    `Run finished in ${record.durationMs}ms — ${passed} passed, ${failed} failed, ${skipped} skipped`,
  );
}

function clearGameRuns(state: RunnerState, fileService: FileService['Type'], gameID: string) {
  return Effect.gen(function* () {
    for (const [runID, run] of state.runs.entries()) {
      if (run.gameIDs.includes(gameID) && !state.activeFibers.has(runID)) {
        state.runs.delete(runID);
      }
    }

    yield* saveRuns(fileService, state.runs).pipe(
      Effect.tapError((err) => {
        console.error('[runner] Failed to save runs after clear:', err);
        return Effect.succeed(undefined);
      }),
      Effect.orElse(() => {
        return Effect.succeed(undefined);
      }),
    );
  });
}

function createRecord(runID: string, gameIDs: string[]): InternalRunRecord {
  return {
    runID,
    gameIDs,
    status: 'running',
    startedAt: new Date().toISOString(),
    results: {},
    logs: [],
    playwrightErrors: [],
    rawOutput: '',
  };
}

export { RunnerService };

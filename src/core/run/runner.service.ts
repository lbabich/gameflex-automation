import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { Effect, Fiber, Layer } from 'effect';
import type { GameEntry, RunHints, RunRecord } from '../../shared/types';
import { GameNotFoundError, RunAlreadyActiveError, RunNotFoundError } from '../errors';
import { FileService } from '../file.service';
import { GamesService } from '../game-catalog/game-catalog.module';
import type { InternalRunRecord } from '../types';
import { buildCommand } from './command';
import { loadRuns, saveRuns, trimMemory } from './persistence';
import { ProcessExecutorService } from './process';
import { RunFinalizationService } from './run-finalization.service';
import { RunLoggerService } from './run-logger.service';
import { RunStateService } from './run-state.service';

type RunnerState = {
  runs: Map<string, InternalRunRecord>;
  activeRunsByGame: Map<string, string>;
  activeFibers: Map<string, Fiber.RuntimeFiber<void, never>>;
};

type StartRunServices = {
  gamesService: GamesService['Type'];
  fileService: FileService['Type'];
  runLoggerService: RunLoggerService['Type'];
  processExecutorService: ProcessExecutorService['Type'];
  runFinalizationService: RunFinalizationService['Type'];
};

type StartRunParams = {
  gameIDs: string[];
  deviceTypes: string[];
  steps?: string[];
  hints?: RunHints;
};

type FinalizeServices = {
  runFinalizationService: RunFinalizationService['Type'];
  runLoggerService: RunLoggerService['Type'];
  fileService: FileService['Type'];
};

type FinalizeResult = {
  runID: string;
  code: number;
  outputFilePath: string;
};

export class RunnerService extends Effect.Tag('RunnerService')<
  RunnerService,
  {
    startRun: (
      params: StartRunParams,
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
    const processExecutorService = yield* ProcessExecutorService;
    const runFinalizationService = yield* RunFinalizationService;

    const loadedRuns = yield* loadRuns();

    for (const run of loadedRuns) {
      state.runs.set(run.runID, run);
    }

    return {
      startRun: (params: StartRunParams) => {
        return startRun(
          state,
          {
            gamesService,
            fileService,
            runLoggerService,
            processExecutorService,
            runFinalizationService,
          },
          params,
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

function startRun(state: RunnerState, services: StartRunServices, params: StartRunParams) {
  const {
    gamesService,
    fileService,
    runLoggerService,
    processExecutorService,
    runFinalizationService,
  } = services;
  const { gameIDs, deviceTypes, steps, hints } = params;

  return Effect.gen(function* () {
    yield* checkNoActiveRuns(state, gameIDs);

    const selectedGames = yield* fetchAndValidateGames(gamesService, gameIDs);

    const runID = randomUUID();
    const record = createRecord(runID, gameIDs);

    state.runs.set(runID, record);

    for (const id of gameIDs) {
      state.activeRunsByGame.set(id, runID);
    }

    const outputFilePath = path.resolve('src/core/data/run-outputs', `${runID}.json`);
    const cmd = buildCommand(runID, selectedGames, deviceTypes, outputFilePath, steps, hints);

    yield* runLoggerService.log(runID, 'runner', `Starting run ${runID}`);
    yield* runLoggerService.log(runID, 'runner', `Command: ${cmd}`);

    const background = Effect.gen(function* () {
      yield* runLoggerService.log(runID, 'runner', 'Spawning playwright process');

      const { code } = yield* processExecutorService.execute(cmd);

      yield* runLoggerService.log(runID, 'runner', `Process exited with code ${code}`);

      yield* finalizeRun(
        state,
        { runFinalizationService, runLoggerService, fileService },
        { runID, code, outputFilePath },
      );
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

function checkNoActiveRuns(state: RunnerState, gameIDs: string[]) {
  return Effect.sync(() => {
    return gameIDs.find((id) => {
      return state.activeRunsByGame.has(id);
    });
  }).pipe(
    Effect.flatMap((conflicting) => {
      if (conflicting !== undefined) {
        return Effect.fail(new RunAlreadyActiveError({ gameID: conflicting }));
      }

      return Effect.void;
    }),
  );
}

function fetchAndValidateGames(gamesService: StartRunServices['gamesService'], gameIDs: string[]) {
  return Effect.gen(function* () {
    const gameList = yield* gamesService.list();

    const firstMissingID = gameIDs.find((id: string) => {
      return !gameList.some((game: GameEntry) => {
        return game.id === id;
      });
    });

    if (firstMissingID !== undefined) {
      return yield* Effect.fail(new GameNotFoundError({ id: firstMissingID }));
    }

    return gameList.filter((game: GameEntry) => {
      return gameIDs.includes(game.id);
    });
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

function finalizeRun(state: RunnerState, services: FinalizeServices, result: FinalizeResult) {
  const { runFinalizationService, runLoggerService, fileService } = services;
  const { runID, code, outputFilePath } = result;

  return Effect.gen(function* () {
    const record = state.runs.get(runID);

    if (!record) {
      return;
    }

    const finalized = yield* runFinalizationService.finalize(record, code, outputFilePath);

    yield* persistFinishedRun(state, fileService, runLoggerService, runID, finalized);
  });
}

function persistFinishedRun(
  state: RunnerState,
  fileService: FileService['Type'],
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  updated: InternalRunRecord,
) {
  return Effect.gen(function* () {
    state.runs.set(runID, updated);

    yield* saveRunsIgnoreError(fileService, state.runs, runLoggerService, runID);
    yield* logSummary(runLoggerService, updated);
    trimMemory(state.runs);
    cleanupActive(state, runID, updated.gameIDs);
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

    cleanupActive(state, runID, run?.gameIDs ?? []);
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

    cleanupActive(state, runID, record.gameIDs);

    yield* saveRunsIgnoreError(fileService, state.runs, runLoggerService, runID);
  });
}

function cleanupActive(state: RunnerState, runID: string, gameIDs: string[]) {
  state.activeFibers.delete(runID);

  for (const id of gameIDs) {
    state.activeRunsByGame.delete(id);
  }
}

function saveRunsIgnoreError(
  fileService: FileService['Type'],
  runs: RunnerState['runs'],
  runLoggerService: RunLoggerService['Type'],
  runID: string,
) {
  return saveRuns(fileService, runs).pipe(
    Effect.tapError((err) => {
      return runLoggerService.error(runID, 'runner', 'Failed to save runs', err);
    }),
    Effect.orElse(() => {
      return Effect.succeed(undefined);
    }),
  );
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

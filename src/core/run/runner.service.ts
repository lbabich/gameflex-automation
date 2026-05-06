import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { Effect, Layer } from 'effect';
import type { GameEntry, RunHints, RunRecord } from '../../shared/types';
import { GameNotFoundError, RunAlreadyActiveError, RunNotFoundError } from '../errors';
import { FileService } from '../file-service/service';
import { GamesService } from '../game-catalog/game-catalog.module';
import type { InternalRunRecord } from '../types';
import { persistence } from './persistence';
import { ProcessExecutorService } from './process-executor.service';
import { RunFinalizationService } from './run-finalization.service';
import { RunLoggerService } from './run-logger.service';
import { type RunState, RunStateManagerService } from './run-state.manager';

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

const DEFAULT_STEPS = ['gameLoad', 'spinCycle'];

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
    const runStateManager = yield* RunStateManagerService;
    const runLoggerService = yield* RunLoggerService;
    const fileService = yield* FileService;
    const gamesService = yield* GamesService;
    const processExecutorService = yield* ProcessExecutorService;
    const runFinalizationService = yield* RunFinalizationService;

    const loadedRuns = yield* persistence.loadRuns();

    runStateManager.seed(loadedRuns);

    return {
      startRun: (params: StartRunParams) => {
        return startRun(
          runStateManager,
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
        return cancelRun(runStateManager, fileService, runLoggerService, runID);
      },
      getRun: (runID: string) => {
        return getRun(runStateManager, runID);
      },
      getRecentRuns: (limit?: number) => {
        return getRecentRuns(runStateManager, limit);
      },
      clearGameRuns: (gameID: string) => {
        return clearGameRuns(runStateManager, fileService, runLoggerService, gameID);
      },
    };
  }),
);

function startRun(runStateManager: RunState, services: StartRunServices, params: StartRunParams) {
  const {
    gamesService,
    fileService,
    runLoggerService,
    processExecutorService,
    runFinalizationService,
  } = services;
  const { gameIDs, deviceTypes, steps, hints } = params;

  return Effect.gen(function* () {
    yield* checkNoActiveRuns(runStateManager, gameIDs);

    const selectedGames = yield* fetchAndValidateGames(gamesService, gameIDs);

    const runID = randomUUID();
    const record = createRecord(runID, gameIDs);

    runStateManager.register(runID, record, gameIDs);

    const outputFilePath = path.resolve('src/core/data/run-outputs', `${runID}.json`);
    const cmd = buildCommand(runID, selectedGames, deviceTypes, outputFilePath, steps, hints);

    yield* runLoggerService.log(runID, 'runner', `Starting run ${runID}`);
    yield* runLoggerService.log(runID, 'runner', `Command: ${cmd}`);

    const background = Effect.gen(function* () {
      yield* runLoggerService.log(runID, 'runner', 'Spawning playwright process');

      const { code } = yield* processExecutorService.execute(cmd);

      yield* runLoggerService.log(runID, 'runner', `Process exited with code ${code}`);

      yield* finalizeRun(
        runStateManager,
        { runFinalizationService, runLoggerService, fileService },
        { runID, code, outputFilePath },
      );
    }).pipe(
      Effect.catchAll((error: never) => {
        return handleFiberError(runStateManager, runLoggerService, runID, error);
      }),
    );

    const fiber = yield* Effect.forkDaemon(background);

    runStateManager.attachFiber(runID, fiber);

    return record as RunRecord;
  });
}

function checkNoActiveRuns(runStateManager: RunState, gameIDs: string[]) {
  return Effect.sync(() => {
    return gameIDs.find((id) => {
      return runStateManager.getActiveRunID(id) !== undefined;
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

function buildCommand(
  runID: string,
  games: GameEntry[],
  deviceTypes: string[],
  outputFilePath: string,
  steps: string[] = DEFAULT_STEPS,
  hints?: RunHints,
) {
  const gamesArg = Buffer.from(JSON.stringify(games)).toString('base64');
  const devices = deviceTypes.join(',');
  const stepsArg = steps.join(',');

  let cmd = `npx tsx src/core/game-session-automation/runner.ts --runID=${runID} --games=${gamesArg} --deviceTypes=${devices} --steps=${stepsArg} --outputFile=${outputFilePath}`;

  if (hints?.spinCycle || hints?.gameClose) {
    cmd += ` --hints=${Buffer.from(JSON.stringify(hints)).toString('base64')}`;
  }

  return cmd;
}

function finalizeRun(
  runStateManager: RunState,
  services: FinalizeServices,
  result: FinalizeResult,
) {
  const { runFinalizationService, runLoggerService, fileService } = services;
  const { runID, code, outputFilePath } = result;

  return Effect.gen(function* () {
    yield* runFinalizationService.finalize(runID, code, outputFilePath);

    const finalized = runStateManager.get(runID);

    if (!finalized) {
      return;
    }

    yield* saveRunsIgnoreError(fileService, runStateManager.snapshot(), runLoggerService, runID);
    yield* logSummary(runLoggerService, finalized);
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
  runStateManager: RunState,
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  error: unknown,
) {
  return Effect.gen(function* () {
    yield* runLoggerService.error(runID, 'runner', 'Background fiber error:', error);

    runStateManager.fiberError(runID);
  });
}

function cancelRun(
  runStateManager: RunState,
  fileService: FileService['Type'],
  runLoggerService: RunLoggerService['Type'],
  runID: string,
) {
  return Effect.gen(function* () {
    yield* runStateManager.cancel(runID);

    yield* saveRunsIgnoreError(fileService, runStateManager.snapshot(), runLoggerService, runID);
  });
}

function getRun(runStateManager: RunState, runID: string) {
  return Effect.gen(function* () {
    const record = runStateManager.get(runID);

    if (!record) {
      return yield* Effect.fail(new RunNotFoundError({ runID }));
    }

    return record;
  });
}

function getRecentRuns(runStateManager: RunState, limit = 10) {
  return Effect.sync(() => {
    return runStateManager
      .getAll()
      .sort((runA: RunRecord, runB: RunRecord) => {
        return new Date(runB.startedAt).getTime() - new Date(runA.startedAt).getTime();
      })
      .slice(0, limit);
  });
}

function clearGameRuns(
  runStateManager: RunState,
  fileService: FileService['Type'],
  runLoggerService: RunLoggerService['Type'],
  gameID: string,
) {
  return Effect.gen(function* () {
    runStateManager.clearGame(gameID);

    yield* saveRunsIgnoreError(fileService, runStateManager.snapshot(), runLoggerService, gameID);
  });
}

function saveRunsIgnoreError(
  fileService: FileService['Type'],
  runs: Map<string, InternalRunRecord>,
  runLoggerService: RunLoggerService['Type'],
  runID: string,
) {
  return persistence.saveRuns(fileService, runs).pipe(
    Effect.tapError((err) => {
      return runLoggerService.error(runID, 'runner', 'Failed to save runs', err);
    }),
    Effect.orElse(() => {
      return Effect.succeed(undefined);
    }),
  );
}

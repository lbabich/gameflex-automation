import { randomUUID } from 'node:crypto';
import { Effect, Fiber, Layer } from 'effect';
import { GameNotFoundError, RunAlreadyActiveError, RunNotFoundError } from '../../errors';
import type { GameEntry } from '../../lib/games';
import { FileService } from '../file.service';
import { GamesService } from '../games.service';
import { buildSpinCommand } from './command';
import { attachGifUrls, attachScreenshotUrls, cleanupImages } from './media';
import { parseSpinOutput } from './output-parser';
import { loadRuns, saveRuns, trimMemory } from './persistence';
import { spawnProcess } from './process';
import type { InternalRunRecord, RunRecord } from '../../types';

export type { RunRecord, RunStatus, TestResult, TestStep } from '../../types';

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
    ) => Effect.Effect<RunRecord, RunAlreadyActiveError | GameNotFoundError>;
    cancelRun: (runID: string) => Effect.Effect<void, RunNotFoundError>;
    getRun: (runID: string) => Effect.Effect<RunRecord, RunNotFoundError>;
    getRecentRuns: (limit?: number) => Effect.Effect<RunRecord[]>;
  }
>() {}

export const NodeRunnerService = Layer.effect(
  RunnerService,
  Effect.gen(function* () {
    const fileService = yield* FileService;
    const gamesService = yield* GamesService;

    const state: RunnerState = {
      runs: new Map(),
      activeRunsByGame: new Map(),
      activeFibers: new Map(),
    };

    const loadedRuns = yield* loadRuns();

    for (const run of loadedRuns) {
      state.runs.set(run.runID, run);
    }

    return {
      startRun: (gameIDs: string[], deviceTypes: string[], playmode: string) => {
        return startRun(state, gamesService, fileService, gameIDs, deviceTypes, playmode);
      },
      cancelRun: (runID: string) => {
        return cancelRun(state, fileService, runID);
      },
      getRun: (runID: string) => {
        return getRun(state, runID);
      },
      getRecentRuns: (limit?: number) => {
        return getRecentRuns(state, limit);
      },
    };
  }),
);

function startRun(
  state: RunnerState,
  gamesService: GamesService['Type'],
  fileService: FileService['Type'],
  gameIDs: string[],
  deviceTypes: string[],
  playmode: string,
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

    const cmd = buildSpinCommand(runID, gameIDs, deviceTypes, playmode);

    console.log(`[runner] Starting run ${runID}`);
    console.log(`[runner] Command: ${cmd}`);

    const background = Effect.gen(function* () {
      const { code, stdout } = yield* spawnProcess(cmd);

      yield* finalizeRun(state, record, code, stdout);
    }).pipe(
      Effect.provideService(FileService, fileService),
      Effect.catchAll((error: never) => {
        console.error('[runner] Background fiber error:', error);

        if (record.status === 'running') {
          record.status = 'error';
          record.finishedAt = new Date().toISOString();
          record.durationMs =
            new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();
        }

        state.activeFibers.delete(record.runID);

        for (const id of record.gameIDs) {
          state.activeRunsByGame.delete(id);
        }

        return Effect.succeed(undefined);
      }),
    );

    const fiber = yield* Effect.forkDaemon(background);

    state.activeFibers.set(runID, fiber);

    return record;
  });
}

function cancelRun(state: RunnerState, fileService: FileService['Type'], runID: string) {
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

    yield* saveRuns(state.runs).pipe(Effect.provideService(FileService, fileService));
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

function finalizeRun(state: RunnerState, record: InternalRunRecord, code: number, stdout: string) {
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

    yield* attachScreenshotUrls(record.results);
    yield* attachGifUrls(record.runID, record.results);
    yield* cleanupImages(record.results);
    yield* saveRuns(state.runs);

    logSummary(record);
    trimMemory(state.runs);

    state.activeFibers.delete(record.runID);

    for (const id of record.gameIDs) {
      state.activeRunsByGame.delete(id);
    }
  });
}

function logSummary(record: InternalRunRecord) {
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

  console.log(
    `[runner] Run ${record.runID} finished in ${record.durationMs}ms — ${passed} passed, ${failed} failed, ${skipped} skipped`,
  );
}

function createRecord(runID: string, gameIDs: string[]): InternalRunRecord {
  return {
    runID,
    gameIDs,
    status: 'running',
    startedAt: new Date().toISOString(),
    results: {},
    playwrightErrors: [],
    rawOutput: '',
  };
}

export { RunnerService };

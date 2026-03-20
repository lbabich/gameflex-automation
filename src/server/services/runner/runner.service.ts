import { randomUUID } from 'node:crypto';
import { Effect, Fiber, Layer } from 'effect';
import * as games from '../../../lib/games';
import { GameNotFoundError, RunAlreadyActiveError, RunNotFoundError } from '../../errors';
import { FileService } from '../file.service';
import { buildPlaywrightCommand } from './command';
import { finalizeRun, RUNS_FILE, type RunnerState, saveRuns } from './finalize';
import { spawnProcess } from './process';
import type { RunRecord } from './types';

export type { RunRecord, RunStatus, TestResult, TestStep } from './types';

function resolveNames(gameIDs: string[]): { names: string[]; firstMissingID: string | undefined } {
  const gameList = games.readGames();
  const names: string[] = [];
  let firstMissingID: string | undefined;

  for (const id of gameIDs) {
    const game = gameList.find((entry: games.GameEntry) => {
      return entry.id === id;
    });

    if (game) {
      names.push(game.name);
    } else if (firstMissingID === undefined) {
      firstMissingID = id;
    }
  }

  return { names, firstMissingID };
}

function createRecord(runID: string, gameIDs: string[]): RunRecord {
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

export class RunnerService extends Effect.Tag('RunnerService')<
  RunnerService,
  {
    startRun: (
      gameIDs: string[],
      projects?: string[],
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

    const state: RunnerState = {
      runs: new Map(),
      activeRunsByGame: new Map(),
      activeFibers: new Map(),
    };

    const loadedRuns = yield* fileService.read(RUNS_FILE).pipe(
      Effect.flatMap((fileContent) => {
        return Effect.try({
          try: () => {
            return JSON.parse(fileContent) as RunRecord[];
          },
          catch: () => {
            return null;
          },
        });
      }),
      Effect.catchAll(() => {
        return Effect.succeed([] as RunRecord[]);
      }),
    );

    for (const run of loadedRuns) {
      state.runs.set(run.runID, run);
    }

    return {
      startRun: (gameIDs: string[], projects?: string[]) => {
        return Effect.gen(function* () {
          const conflicting = gameIDs.filter((id) => {
            return state.activeRunsByGame.has(id);
          });

          if (conflicting.length > 0) {
            return yield* Effect.fail(new RunAlreadyActiveError({ gameID: conflicting[0] ?? '' }));
          }

          const { names, firstMissingID } = resolveNames(gameIDs);

          if (firstMissingID !== undefined) {
            return yield* Effect.fail(new GameNotFoundError({ id: firstMissingID }));
          }

          const runID = randomUUID();
          const record = createRecord(runID, gameIDs);

          state.runs.set(runID, record);

          for (const id of gameIDs) {
            state.activeRunsByGame.set(id, runID);
          }

          const cmd = buildPlaywrightCommand(names, projects);

          console.log(`[runner] Starting run ${runID}`);
          console.log(`[runner] Command: ${cmd}`);

          const background = Effect.gen(function* () {
            const { code, stdout } = yield* spawnProcess(cmd);

            yield* finalizeRun(state, record, code, stdout);
          }).pipe(
            Effect.provideService(FileService, fileService),
            Effect.catchAll((error) => {
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
      },

      cancelRun: (runID) => {
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

          yield* saveRuns(state).pipe(Effect.provideService(FileService, fileService));
        });
      },

      getRun: (runID) => {
        return Effect.gen(function* () {
          const record = state.runs.get(runID);

          if (!record) {
            return yield* Effect.fail(new RunNotFoundError({ runID }));
          }

          return record;
        });
      },

      getRecentRuns: (limit = 10) => {
        return Effect.sync(() => {
          return [...state.runs.values()]
            .sort((a, b) => {
              return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
            })
            .slice(0, limit);
        });
      },
    };
  }),
);

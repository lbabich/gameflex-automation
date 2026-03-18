import { randomUUID } from 'node:crypto';
import { Effect, Fiber, Layer } from 'effect';
import * as games from '../../../lib/games';
import {
  GameNotFoundError,
  ParseError,
  RunAlreadyActiveError,
  RunNotFoundError,
} from '../../errors';
import { FileService } from '../file';
import { buildPlaywrightCommand } from './command';
import { finalizeRun, RUNS_FILE, type RunnerState, saveRuns } from './finalize';
import { spawnProcess } from './process';
import type { RunRecord } from './types';

export type { RunRecord, RunStatus, TestResult, TestStep } from './types';

function resolveNames(gameIds: string[]): { names: string[]; firstMissingId: string | undefined } {
  const gameList = games.readGames();
  const names: string[] = [];
  let firstMissingId: string | undefined;

  for (const id of gameIds) {
    const game = gameList.find((g: games.GameEntry) => {
      return g.id === id;
    });

    if (game) {
      names.push(game.name);
    } else if (firstMissingId === undefined) {
      firstMissingId = id;
    }
  }

  return { names, firstMissingId };
}

function createRecord(runId: string, gameIds: string[]): RunRecord {
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

export class RunnerService extends Effect.Tag('RunnerService')<
  RunnerService,
  {
    startRun: (
      gameIds: string[],
      projects?: string[],
    ) => Effect.Effect<RunRecord, RunAlreadyActiveError | GameNotFoundError>;
    cancelRun: (runId: string) => Effect.Effect<void, RunNotFoundError>;
    getRun: (runId: string) => Effect.Effect<RunRecord, RunNotFoundError>;
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
      Effect.flatMap((raw) => {
        return Effect.try({
          try: () => {
            return JSON.parse(raw) as RunRecord[];
          },
          catch: () => {
            return new ParseError({ message: 'corrupt runs.json' });
          },
        });
      }),
      Effect.catchAll(() => {
        return Effect.succeed([] as RunRecord[]);
      }),
    );

    for (const run of loadedRuns) {
      state.runs.set(run.runId, run);
    }

    return {
      startRun: (gameIds: string[], projects?: string[]) => {
        return Effect.gen(function* () {
          const conflicting = gameIds.filter((id) => {
            return state.activeRunsByGame.has(id);
          });

          if (conflicting.length > 0) {
            return yield* Effect.fail(new RunAlreadyActiveError({ gameId: conflicting[0] ?? '' }));
          }

          const { names, firstMissingId } = resolveNames(gameIds);

          if (firstMissingId !== undefined) {
            return yield* Effect.fail(new GameNotFoundError({ id: firstMissingId }));
          }

          const runId = randomUUID();
          const record = createRecord(runId, gameIds);

          state.runs.set(runId, record);

          for (const id of gameIds) {
            state.activeRunsByGame.set(id, runId);
          }

          const cmd = buildPlaywrightCommand(names, projects);

          console.log(`[runner] Starting run ${runId}`);
          console.log(`[runner] Command: ${cmd}`);

          const background = Effect.gen(function* () {
            const { code, stdout } = yield* spawnProcess(cmd);

            yield* finalizeRun(state, record, code, stdout);
          }).pipe(
            Effect.provideService(FileService, fileService),
            Effect.catchAll((err) => {
              console.error('[runner] Background fiber error:', err);

              if (record.status === 'running') {
                record.status = 'error';
                record.finishedAt = new Date().toISOString();
                record.durationMs =
                  new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();
              }

              state.activeFibers.delete(record.runId);

              for (const id of record.gameIds) {
                state.activeRunsByGame.delete(id);
              }

              return Effect.succeed(undefined);
            }),
          );

          const fiber = yield* Effect.forkDaemon(background);

          state.activeFibers.set(runId, fiber);

          return record;
        });
      },

      cancelRun: (runId) => {
        return Effect.gen(function* () {
          const fiber = state.activeFibers.get(runId);
          const record = state.runs.get(runId);

          if (!fiber || !record) {
            return yield* Effect.fail(new RunNotFoundError({ runId }));
          }

          record.status = 'cancelled';
          record.finishedAt = new Date().toISOString();
          record.durationMs =
            new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime();

          yield* Fiber.interrupt(fiber);

          state.activeFibers.delete(runId);

          for (const id of record.gameIds) {
            state.activeRunsByGame.delete(id);
          }

          yield* saveRuns(state).pipe(
            Effect.provideService(FileService, fileService),
            Effect.catchAll((err) => {
              console.error('[runner] Failed to persist cancellation:', err);

              return Effect.succeed(undefined);
            }),
          );
        });
      },

      getRun: (runId) => {
        return Effect.gen(function* () {
          const record = state.runs.get(runId);

          if (!record) {
            return yield* Effect.fail(new RunNotFoundError({ runId }));
          }

          return record;
        });
      },

      getRecentRuns: (limit = 50) => {
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

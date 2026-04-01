import { randomUUID } from 'node:crypto';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { describe, expect, it } from 'vitest';
import type { RunRecord } from '../../shared/types';
import { GameNotFoundError, RunNotFoundError } from '../errors';
import type { GameEntry } from '../lib/games';
import { FileService } from '../services/file.service';
import { GamesService } from '../services/games.service';
import { RunLoggerService } from '../services/runner/run-logger.service';
import { RunStateService } from '../services/runner/run-state.service';
import { NodeRunnerService, RunnerService } from '../services/runner/runner.service';

describe('RunnerService', () => {
  describe('getRun', () => {
    it('returns a run loaded from storage', async () => {
      const run = makeRunRecord({ runID: 'stored-run' });
      const runtime = makeTestRuntime(JSON.stringify([run]));

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          return yield* SUT.getRun('stored-run');
        }),
      );

      expect(result.runID).toBe('stored-run');
    });

    it('fails with RunNotFoundError for an unknown run id', async () => {
      const runtime = makeTestRuntime();

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          return yield* Effect.flip(SUT.getRun('nonexistent'));
        }),
      );

      expect(result).toBeInstanceOf(RunNotFoundError);
    });
  });

  describe('cancelRun', () => {
    it('fails with RunNotFoundError for an unknown run id', async () => {
      const runtime = makeTestRuntime();

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          return yield* Effect.flip(SUT.cancelRun('nonexistent'));
        }),
      );

      expect(result).toBeInstanceOf(RunNotFoundError);
    });
  });

  describe('startRun', () => {
    it('fails with GameNotFoundError for an unknown game id', async () => {
      const runtime = makeTestRuntime();

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          return yield* Effect.flip(
            SUT.startRun({ gameIDs: [randomUUID()], deviceTypes: ['desktop'], playmode: 'demo' }),
          );
        }),
      );

      expect(result).toBeInstanceOf(GameNotFoundError);
    });
  });

  describe('getRecentRuns', () => {
    it('returns an empty array when no runs exist', async () => {
      const runtime = makeTestRuntime();

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          return yield* SUT.getRecentRuns();
        }),
      );

      expect(result).toHaveLength(0);
    });

    it('returns runs sorted newest first', async () => {
      const runA = makeRunRecord({ runID: 'run-a', startedAt: '2024-01-01T00:00:00.000Z' });
      const runB = makeRunRecord({ runID: 'run-b', startedAt: '2024-01-02T00:00:00.000Z' });
      const runtime = makeTestRuntime(JSON.stringify([runA, runB]));

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          return yield* SUT.getRecentRuns();
        }),
      );

      expect(result[0].runID).toBe('run-b');
      expect(result[1].runID).toBe('run-a');
    });

    it('respects the limit parameter', async () => {
      const runs = Array.from({ length: 5 }, (_, i) => {
        return makeRunRecord({
          runID: `run-${i}`,
          startedAt: `2024-01-0${i + 1}T00:00:00.000Z`,
        });
      });

      const runtime = makeTestRuntime(JSON.stringify(runs));

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          return yield* SUT.getRecentRuns(3);
        }),
      );

      expect(result).toHaveLength(3);
    });
  });

  describe('startRun + cancelRun', () => {
    it('startRun returns a record with running status', async () => {
      const testGame = makeTestGame();
      const runtime = makeTestRuntime('[]', [testGame]);

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          return yield* SUT.startRun({
            gameIDs: [testGame.id],
            deviceTypes: ['desktop'],
            playmode: 'demo',
          });
        }),
      );

      expect(result.runID).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(result.gameIDs).toEqual([testGame.id]);
      expect(result.status).toBe('running');
    });

    it('cancelRun sets status to cancelled', async () => {
      const testGame = makeTestGame();
      const runtime = makeTestRuntime('[]', [testGame]);

      await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          const runRecord = yield* SUT.startRun({
            gameIDs: [testGame.id],
            deviceTypes: ['desktop'],
            playmode: 'demo',
          });

          yield* SUT.cancelRun(runRecord.runID);

          const result = yield* SUT.getRun(runRecord.runID);

          expect(result.status).toBe('cancelled');
        }),
      );
    });
  });
});

function makeTestRuntime(runsJson = '[]', gameEntries: GameEntry[] = []) {
  const testFileService = Layer.succeed(FileService, {
    read: () => {
      return Effect.succeed(runsJson);
    },
    write: () => {
      return Effect.succeed(undefined);
    },
    exists: () => {
      return Effect.succeed(false);
    },
  });

  const testGamesService = Layer.succeed(GamesService, {
    list: () => {
      return Effect.succeed(gameEntries);
    },
    getCachedDeviceMap: () => {
      return Effect.succeed(new Map());
    },
    add: () => {
      return Effect.succeed(undefined);
    },
    update: () => {
      return Effect.succeed(undefined);
    },
    clearAllSteps: () => {
      return Effect.succeed(undefined);
    },
    clearSteps: () => {
      return Effect.succeed(undefined);
    },
  });

  const testRunStateService = Layer.succeed(RunStateService, {
    runs: new Map(),
    activeRunsByGame: new Map(),
    activeFibers: new Map(),
  });

  const testRunLoggerService = Layer.succeed(RunLoggerService, {
    log: () => {
      return Effect.succeed(undefined);
    },
    warn: () => {
      return Effect.succeed(undefined);
    },
    error: () => {
      return Effect.succeed(undefined);
    },
  });

  return ManagedRuntime.make(
    Layer.provide(
      NodeRunnerService,
      Layer.mergeAll(testFileService, testGamesService, testRunStateService, testRunLoggerService),
    ),
  );
}

function makeRunRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    runID: 'test-run',
    gameIDs: [],
    status: 'completed',
    startedAt: '2024-01-01T00:00:00.000Z',
    results: {},
    playwrightErrors: [],
    logs: [],
    ...overrides,
  };
}

function makeTestGame(overrides: Partial<GameEntry> = {}): GameEntry {
  return {
    id: randomUUID(),
    desktopGameID: `test-${randomUUID()}`,
    name: 'Runner Test Game',
    gameProviderID: '',
    ...overrides,
  };
}

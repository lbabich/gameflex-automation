import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { beforeEach, describe, expect, it } from 'vitest';
import { addGame, readGames } from '../../lib/games';
import { GameNotFoundError, RunNotFoundError } from '../../server/errors';
import { FileService } from '../../server/services/file.service';
import type { RunRecord } from '../../server/services/runner/runner.service';
import { NodeRunnerService, RunnerService } from '../../server/services/runner/runner.service';

function makeTestRuntime(runsJson = '[]') {
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

  return ManagedRuntime.make(Layer.provide(NodeRunnerService, testFileService));
}

function makeRunRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    runID: 'test-run',
    gameIDs: [],
    status: 'completed',
    startedAt: '2024-01-01T00:00:00.000Z',
    results: [],
    playwrightErrors: [],
    ...overrides,
  };
}

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

          return yield* Effect.flip(SUT.startRun([randomUUID()]));
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
    const GAMES_PATH = path.resolve(process.env.GAMES_JSON_PATH ?? 'src/data/games.json');

    let testGameID: string;

    beforeEach(() => {
      fs.writeFileSync(GAMES_PATH, '[]');

      const desktopGameID = `test-${randomUUID()}`;

      addGame({
        desktopGameID,
        name: 'Runner Test Game',
        desktopEnabled: true,
        desktopPlaymode: 'demo',
        mobileEnabled: false,
        mobilePlaymode: 'demo',
      });

      const game = readGames().find((entry) => {
        return entry.desktopGameID === desktopGameID;
      });

      if (!game) {
        throw new Error('test game not found after addGame');
      }

      testGameID = game.id;
    });

    it('startRun returns a record with running status', async () => {
      const runtime = makeTestRuntime();

      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          return yield* SUT.startRun([testGameID]);
        }),
      );

      expect(result.runID).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(result.gameIDs).toEqual([testGameID]);
      expect(result.status).toBe('running');
    });

    it('cancelRun sets status to cancelled', async () => {
      const runtime = makeTestRuntime();

      await runtime.runPromise(
        Effect.gen(function* () {
          const SUT = yield* RunnerService;

          const runRecord = yield* SUT.startRun([testGameID]);

          yield* SUT.cancelRun(runRecord.runID);

          const result = yield* SUT.getRun(runRecord.runID);

          expect(result.status).toBe('cancelled');
        }),
      );
    });
  });
});

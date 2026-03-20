import { randomUUID } from 'node:crypto';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { describe, expect, it } from 'vitest';
import { GameNotFoundError, RunNotFoundError } from '../../server/errors';
import { FileService } from '../../server/services/file';
import type { RunRecord } from '../../server/services/runner';
import { NodeRunnerService, RunnerService } from '../../server/services/runner';

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
          const service = yield* RunnerService;

          return yield* service.getRun('stored-run');
        }),
      );

      expect(result.runID).toBe('stored-run');
    });

    it('fails with RunNotFoundError for an unknown run id', async () => {
      const runtime = makeTestRuntime();

      const error = await runtime.runPromise(
        Effect.gen(function* () {
          const service = yield* RunnerService;

          return yield* Effect.flip(service.getRun('nonexistent'));
        }),
      );

      expect(error).toBeInstanceOf(RunNotFoundError);
    });
  });

  describe('cancelRun', () => {
    it('fails with RunNotFoundError for an unknown run id', async () => {
      const runtime = makeTestRuntime();

      const error = await runtime.runPromise(
        Effect.gen(function* () {
          const service = yield* RunnerService;

          return yield* Effect.flip(service.cancelRun('nonexistent'));
        }),
      );

      expect(error).toBeInstanceOf(RunNotFoundError);
    });
  });

  describe('startRun', () => {
    it('fails with GameNotFoundError for an unknown game id', async () => {
      const runtime = makeTestRuntime();

      const error = await runtime.runPromise(
        Effect.gen(function* () {
          const service = yield* RunnerService;

          return yield* Effect.flip(service.startRun([randomUUID()]));
        }),
      );

      expect(error).toBeInstanceOf(GameNotFoundError);
    });
  });

  describe('getRecentRuns', () => {
    it('returns an empty array when no runs exist', async () => {
      const runtime = makeTestRuntime();

      const runs = await runtime.runPromise(
        Effect.gen(function* () {
          const service = yield* RunnerService;

          return yield* service.getRecentRuns();
        }),
      );

      expect(runs).toHaveLength(0);
    });

    it('returns runs sorted newest first', async () => {
      const runA = makeRunRecord({ runID: 'run-a', startedAt: '2024-01-01T00:00:00.000Z' });
      const runB = makeRunRecord({ runID: 'run-b', startedAt: '2024-01-02T00:00:00.000Z' });
      const runtime = makeTestRuntime(JSON.stringify([runA, runB]));

      const runs = await runtime.runPromise(
        Effect.gen(function* () {
          const service = yield* RunnerService;

          return yield* service.getRecentRuns();
        }),
      );

      expect(runs[0].runID).toBe('run-b');
      expect(runs[1].runID).toBe('run-a');
    });
  });
});

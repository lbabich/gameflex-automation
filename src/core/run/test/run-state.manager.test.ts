import { describe, expect, it } from 'vitest';
import type { InternalRunRecord } from '../../types';
import { InvalidTransitionError, RunStateManager } from '../run-state.manager';

function makeRecord(overrides: Partial<InternalRunRecord> = {}): InternalRunRecord {
  return {
    runID: 'run-1',
    gameIDs: ['game-1'],
    status: 'running',
    startedAt: '2024-01-01T00:00:00.000Z',
    results: {},
    logs: [],
    playwrightErrors: [],
    rawOutput: '',
    ...overrides,
  };
}

function seedManager(manager: RunStateManager, record: InternalRunRecord): void {
  manager.register(record.runID, record, record.gameIDs as string[]);
}

describe('RunStateManager', () => {
  describe('emit — unknown runID', () => {
    it('silently no-ops when runID not found', () => {
      const manager = new RunStateManager();

      expect(() => {
        manager.emit('nonexistent', { type: 'Cancelled' });
      }).not.toThrow();
    });
  });

  describe('emit — Cancelled', () => {
    it('transitions running → cancelled and sets finishedAt', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);
      manager.emit(record.runID, { type: 'Cancelled' });

      const result = manager.get(record.runID);

      expect(result?.status).toBe('cancelled');
      expect(result?.finishedAt).toBeDefined();
      expect(result?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('removes the run from the active game map', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);

      expect(manager.getActiveRunID('game-1')).toBe('run-1');

      manager.emit(record.runID, { type: 'Cancelled' });

      expect(manager.getActiveRunID('game-1')).toBeUndefined();
    });

    it('throws InvalidTransitionError when not running', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'completed' });

      seedManager(manager, record);

      expect(() => {
        manager.emit(record.runID, { type: 'Cancelled' });
      }).toThrow(InvalidTransitionError);
    });
  });

  describe('emit — FiberError', () => {
    it('transitions running → error and sets finishedAt', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);
      manager.emit(record.runID, { type: 'FiberError' });

      const result = manager.get(record.runID);

      expect(result?.status).toBe('error');
      expect(result?.finishedAt).toBeDefined();
    });

    it('removes the run from the active game map', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);
      manager.emit(record.runID, { type: 'FiberError' });

      expect(manager.getActiveRunID('game-1')).toBeUndefined();
    });

    it('throws InvalidTransitionError when not running', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'cancelled' });

      seedManager(manager, record);

      expect(() => {
        manager.emit(record.runID, { type: 'FiberError' });
      }).toThrow(InvalidTransitionError);
    });
  });

  describe('emit — ResultsAttached', () => {
    const resultsEvent = {
      type: 'ResultsAttached' as const,
      rawOutput: '{}',
      finishedAt: '2024-01-01T00:01:00.000Z',
      durationMs: 60_000,
      status: 'completed' as const,
      results: {},
      playwrightErrors: [],
    };

    it('attaches results when running', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);
      manager.emit(record.runID, resultsEvent);

      const result = manager.get(record.runID);

      expect(result?.status).toBe('completed');
      expect(result?.finishedAt).toBe('2024-01-01T00:01:00.000Z');
      expect(result?.durationMs).toBe(60_000);
    });

    it('attaches results when cancelled (process finishes after cancel)', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);
      manager.emit(record.runID, { type: 'Cancelled' });
      manager.emit(record.runID, resultsEvent);

      const result = manager.get(record.runID);

      expect(result?.status).toBe('completed');
    });

    it('throws InvalidTransitionError when already completed', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);
      manager.emit(record.runID, resultsEvent);

      expect(() => {
        manager.emit(record.runID, resultsEvent);
      }).toThrow(InvalidTransitionError);
    });

    it('attaches optional parseError when provided', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);
      manager.emit(record.runID, { ...resultsEvent, parseError: 'bad json' });

      const result = manager.get(record.runID);

      expect(result?.parseError).toBe('bad json');
    });
  });

  describe('emit — MediaAttached', () => {
    it('attaches mediaResult', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);
      manager.emit(record.runID, {
        type: 'MediaAttached',
        mediaResult: { desktop: { gif: 'ok', cleanup: 'ok' } },
      });

      const result = manager.get(record.runID);

      expect(result?.mediaResult).toEqual({ desktop: { gif: 'ok', cleanup: 'ok' } });
    });

    it('removes the run from the active game map', () => {
      const manager = new RunStateManager();
      const record = makeRecord({ status: 'running' });

      seedManager(manager, record);

      expect(manager.getActiveRunID('game-1')).toBe('run-1');

      manager.emit(record.runID, { type: 'MediaAttached', mediaResult: {} });

      expect(manager.getActiveRunID('game-1')).toBeUndefined();
    });
  });

  describe('trimMemory via MediaAttached', () => {
    it('keeps at most 10 runs in memory after a terminal event', () => {
      const manager = new RunStateManager();

      for (let i = 0; i < 12; i++) {
        const record = makeRecord({
          runID: `run-${i}`,
          gameIDs: [`game-${i}`],
          startedAt: new Date(i * 1000).toISOString(),
        });

        manager.register(record.runID, record, record.gameIDs as string[]);
      }

      manager.emit('run-11', { type: 'MediaAttached', mediaResult: {} });

      expect(manager.getAll().length).toBeLessThanOrEqual(10);
    });
  });
});

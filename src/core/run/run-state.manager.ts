import { Effect, Fiber, Layer } from 'effect';
import type { DeviceType, RunStatus } from '../../shared/types';
import { RunNotFoundError } from '../errors';
import type { InternalRunRecord, InternalTestResult, MediaResult } from '../types';
import { persistence } from './persistence';

export type RunEvent =
  | { type: 'Cancelled' }
  | { type: 'FiberError' }
  | {
      type: 'ResultsAttached';
      rawOutput: string;
      finishedAt: string;
      durationMs: number;
      status: RunStatus;
      results: Readonly<Partial<Record<DeviceType, InternalTestResult>>>;
      playwrightErrors: readonly string[];
      parseError?: string;
    }
  | { type: 'MediaAttached'; mediaResult: MediaResult };

export class RunStateManager {
  private runs = new Map<string, InternalRunRecord>();
  private activeRunsByGame = new Map<string, string>();
  private activeFibers = new Map<string, Fiber.RuntimeFiber<void, never>>();

  seed(loadedRuns: InternalRunRecord[]): void {
    for (const run of loadedRuns) {
      this.runs.set(run.runID, run);
    }
  }

  register(runID: string, record: InternalRunRecord, gameIDs: string[]): void {
    this.runs.set(runID, record);

    for (const id of gameIDs) {
      this.activeRunsByGame.set(id, runID);
    }
  }

  attachFiber(runID: string, fiber: Fiber.RuntimeFiber<void, never>): void {
    this.activeFibers.set(runID, fiber);
  }

  emit(runID: string, event: RunEvent): void {
    const record = this.runs.get(runID);

    if (!record) {
      return;
    }

    this.runs.set(runID, transition(record, event));

    if (
      event.type === 'Cancelled' ||
      event.type === 'FiberError' ||
      event.type === 'MediaAttached'
    ) {
      this.deactivate(runID, record.gameIDs);
      persistence.trimMemory(this.runs);
    }
  }

  cancel(runID: string): Effect.Effect<void, RunNotFoundError> {
    const fiber = this.activeFibers.get(runID);
    const record = this.runs.get(runID);

    if (!fiber || !record) {
      return Effect.fail(new RunNotFoundError({ runID }));
    }

    this.emit(runID, { type: 'Cancelled' });

    return Fiber.interrupt(fiber).pipe(Effect.asVoid);
  }

  clearGame(gameID: string): void {
    for (const [runID, run] of this.runs.entries()) {
      if (run.gameIDs.includes(gameID) && !this.activeFibers.has(runID)) {
        this.runs.delete(runID);
      }
    }
  }

  getInactiveGameRunIDs(gameID: string): string[] {
    const ids: string[] = [];

    for (const [runID, run] of this.runs.entries()) {
      if (run.gameIDs.includes(gameID) && !this.activeFibers.has(runID)) {
        ids.push(runID);
      }
    }

    return ids;
  }

  appendLog(runID: string, msg: string): void {
    const record = this.runs.get(runID);

    if (record) {
      this.runs.set(runID, { ...record, logs: [...record.logs, msg] });
    }
  }

  get(runID: string): InternalRunRecord | undefined {
    return this.runs.get(runID);
  }

  getAll(): InternalRunRecord[] {
    return [...this.runs.values()];
  }

  getActiveRunID(gameID: string): string | undefined {
    return this.activeRunsByGame.get(gameID);
  }

  private deactivate(runID: string, gameIDs: readonly string[]): void {
    this.activeFibers.delete(runID);

    for (const id of gameIDs) {
      this.activeRunsByGame.delete(id);
    }
  }
}

export class RunStateManagerService extends Effect.Tag('RunStateManagerService')<
  RunStateManagerService,
  RunStateManager
>() {}

export const NodeRunStateManager = Layer.succeed(RunStateManagerService, new RunStateManager());

export type RunState = RunStateManagerService['Type'];

function transition(run: InternalRunRecord, event: RunEvent): InternalRunRecord {
  switch (event.type) {
    case 'Cancelled': {
      if (run.status !== 'running') {
        throw new InvalidTransitionError(run.status, event.type);
      }

      const finishedAt = new Date().toISOString();

      return {
        ...run,
        status: 'cancelled',
        finishedAt,
        durationMs: new Date(finishedAt).getTime() - new Date(run.startedAt).getTime(),
      };
    }
    case 'FiberError': {
      if (run.status !== 'running') {
        throw new InvalidTransitionError(run.status, event.type);
      }

      const finishedAt = new Date().toISOString();

      return {
        ...run,
        status: 'error',
        finishedAt,
        durationMs: new Date(finishedAt).getTime() - new Date(run.startedAt).getTime(),
      };
    }
    case 'ResultsAttached': {
      if (run.status !== 'running' && run.status !== 'cancelled') {
        throw new InvalidTransitionError(run.status, event.type);
      }

      return {
        ...run,
        rawOutput: event.rawOutput,
        finishedAt: event.finishedAt,
        durationMs: event.durationMs,
        status: event.status,
        results: event.results,
        playwrightErrors: event.playwrightErrors,
        ...(event.parseError !== undefined && { parseError: event.parseError }),
      };
    }
    case 'MediaAttached': {
      return { ...run, mediaResult: event.mediaResult };
    }
  }
}

export class InvalidTransitionError extends Error {
  constructor(status: string, event: string) {
    super(`Cannot apply '${event}' to a run with status '${status}'`);
  }
}

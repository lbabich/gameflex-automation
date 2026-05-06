import { Effect, Fiber, Layer } from 'effect';
import { RunNotFoundError } from '../errors';
import type { InternalRunRecord } from '../types';
import { persistence } from './persistence';
import { runTransition } from './run-transition';

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

  finalize(runID: string, record: InternalRunRecord): void {
    const current = this.runs.get(runID);

    if (current) {
      this.runs.set(runID, runTransition.transition(current, { type: 'Finalized', record }));
    }

    this.deactivate(runID, record.gameIDs);
    persistence.trimMemory(this.runs);
  }

  fiberError(runID: string): void {
    const run = this.runs.get(runID);

    if (run?.status === 'running') {
      this.runs.set(runID, runTransition.transition(run, { type: 'FiberError' }));
    }

    this.deactivate(runID, run?.gameIDs ?? []);
  }

  cancel(runID: string): Effect.Effect<void, RunNotFoundError> {
    const fiber = this.activeFibers.get(runID);
    const record = this.runs.get(runID);

    if (!fiber || !record) {
      return Effect.fail(new RunNotFoundError({ runID }));
    }

    this.runs.set(runID, runTransition.transition(record, { type: 'Cancelled' }));
    this.deactivate(runID, record.gameIDs);

    return Fiber.interrupt(fiber).pipe(Effect.asVoid);
  }

  clearGame(gameID: string): void {
    for (const [runID, run] of this.runs.entries()) {
      if (run.gameIDs.includes(gameID) && !this.activeFibers.has(runID)) {
        this.runs.delete(runID);
      }
    }
  }

  appendLog(runID: string, msg: string): void {
    this.runs.get(runID)?.logs.push(msg);
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

  snapshot(): Map<string, InternalRunRecord> {
    return this.runs;
  }

  private deactivate(runID: string, gameIDs: string[]): void {
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

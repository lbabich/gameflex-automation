import type { InternalRunRecord } from '../types';

export type RunEvent =
  | { type: 'Cancelled' }
  | { type: 'FiberError' }
  | { type: 'Finalized'; record: InternalRunRecord };

export class InvalidTransitionError extends Error {
  constructor(status: string, event: string) {
    super(`Cannot apply '${event}' to a run with status '${status}'`);
  }
}

export function transition(run: InternalRunRecord, event: RunEvent): InternalRunRecord {
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
    case 'Finalized': {
      if (run.status !== 'running' && run.status !== 'cancelled') {
        throw new InvalidTransitionError(run.status, event.type);
      }

      return event.record;
    }
  }
}

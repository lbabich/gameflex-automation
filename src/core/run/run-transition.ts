import type { DeviceType, RunStatus } from '../../shared/types';
import type { InternalRunRecord, InternalTestResult, MediaResult } from '../types';

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

class InvalidTransitionError extends Error {
  constructor(status: string, event: string) {
    super(`Cannot apply '${event}' to a run with status '${status}'`);
  }
}

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

export const runTransition = { InvalidTransitionError, transition };

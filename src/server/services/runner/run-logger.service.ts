import { Effect, Layer } from 'effect';
import { RunStateService } from './run-state.service';

export class RunLoggerService extends Effect.Tag('RunLoggerService')<
  RunLoggerService,
  {
    log: (runID: string, context: string, message: string) => Effect.Effect<void>;
    warn: (runID: string, context: string, message: string) => Effect.Effect<void>;
    error: (
      runID: string,
      context: string,
      message: string,
      error?: unknown,
    ) => Effect.Effect<void>;
  }
>() {}

export const NodeRunLoggerService = Layer.effect(
  RunLoggerService,
  Effect.gen(function* () {
    const state = yield* RunStateService;

    return {
      log: (runID: string, context: string, message: string) => {
        return Effect.sync(() => {
          const msg = `[${context}] ${message}:`;
          const run = state.runs.get(runID);

          if (run) {
            state.runs.set(runID, {
              ...run,
              logs: [...(run.logs ?? []), msg],
            });
          }

          console.log(msg);
        });
      },
      warn: (runID: string, context: string, message: string) => {
        return Effect.sync(() => {
          const msg = `[${context}] ${message}:`;
          const run = state.runs.get(runID);

          if (run) {
            state.runs.set(runID, {
              ...run,
              logs: [...(run.logs ?? []), msg],
            });
          }

          console.warn(msg);
        });
      },
      error: (runID: string, context: string, message: string, error?: unknown) => {
        return Effect.sync(() => {
          const msg = `[${context}] ${message}:`;
          const run = state.runs.get(runID);

          if (run) {
            state.runs.set(runID, {
              ...run,
              logs: [...(run.logs ?? []), msg],
            });
          }

          console.error(msg, error);
        });
      },
    };
  }),
);

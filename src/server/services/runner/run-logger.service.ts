import { Effect, Layer } from 'effect';
import { RunStateService } from './run-state.service';

export class RunLoggerService extends Effect.Tag('RunLoggerService')<
  RunLoggerService,
  {
    log: (runID: string, context: string, message: string) => Effect.Effect<void>;
    warn: (runID: string, context: string, message: string) => Effect.Effect<void>;
    error: (runID: string, context: string, message: string, error?: unknown) => Effect.Effect<void>;
  }
>() {}

export const NodeRunLoggerService = Layer.effect(
    RunLoggerService,
    Effect.gen(function* () {
      const state = yield* RunStateService;

      return {
        log: (runID: string, context: string, message: string) => {
          const msg = `[${context}] ${message}:`;
          const run = state.runs.get(runID);

          return Effect.sync(() => {
            if (run) {
              run.logs.push(msg)
            }

            console.log(msg);
          });
        },
        warn: (runID: string, context: string, message: string) => {
          const msg = `[${context}] ${message}:`;
          const run = state.runs.get(runID);

          return Effect.sync(() => {
            if (run) {
              run.logs.push(msg);
            }

            console.warn(msg);
          });
        },
        error: (runID: string, context: string, message: string, error?: unknown) => {
          const msg = `[${context}] ${message}:`;
          const run = state.runs.get(runID);

          return Effect.sync(() => {
            if (run) {
              run.logs.push(msg);
            }

            console.error(msg, error);
          });
        },
      };
    }),
);

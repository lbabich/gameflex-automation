import { Effect, Layer } from 'effect';
import { RunStateManagerService } from './run-state.manager';

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
    const runStateManager = yield* RunStateManagerService;

    return {
      log: (runID: string, context: string, message: string) => {
        return Effect.sync(() => {
          const msg = `[${context}] ${message}:`;

          runStateManager.appendLog(runID, msg);
          console.log(msg);
        });
      },
      warn: (runID: string, context: string, message: string) => {
        return Effect.sync(() => {
          const msg = `[${context}] ${message}:`;

          runStateManager.appendLog(runID, msg);
          console.warn(msg);
        });
      },
      error: (runID: string, context: string, message: string, error?: unknown) => {
        return Effect.sync(() => {
          const msg = `[${context}] ${message}:`;

          runStateManager.appendLog(runID, msg);
          console.error(msg, error);
        });
      },
    };
  }),
);

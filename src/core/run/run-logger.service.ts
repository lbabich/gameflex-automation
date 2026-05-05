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

          appendLog(state.runs, runID, msg);
          console.log(msg);
        });
      },
      warn: (runID: string, context: string, message: string) => {
        return Effect.sync(() => {
          const msg = `[${context}] ${message}:`;

          appendLog(state.runs, runID, msg);
          console.warn(msg);
        });
      },
      error: (runID: string, context: string, message: string, error?: unknown) => {
        return Effect.sync(() => {
          const msg = `[${context}] ${message}:`;

          appendLog(state.runs, runID, msg);
          console.error(msg, error);
        });
      },
    };
  }),
);

function appendLog(runs: Map<string, { logs: string[] }>, runID: string, msg: string) {
  runs.get(runID)?.logs.push(msg);
}

import { Effect, Layer } from 'effect';

class RunLoggerService extends Effect.Tag('LoggerService')<
  RunLoggerService,
  {
    log: (context: string, message: string) => Effect.Effect<void>;
    warn: (context: string, message: string) => Effect.Effect<void>;
    error: (context: string, message: string, error?: unknown) => Effect.Effect<void>;
  }
>() {}

export const NodeRunLoggerService = Layer.succeed(RunLoggerService, {
  log: (context: string, message: string) => {
    const msg = `[${context}] ${message}:`;
    return Effect.sync(() => {
      console.log(msg);
    });
  },
  warn: (context: string, message: string) => {
    const msg = `[${context}] ${message}:`;
    return Effect.sync(() => {
      console.warn(msg);
    });
  },
  error: (context: string, message: string, error?: unknown) => {
    const msg = `[${context}] ${message}:`;
    return Effect.sync(() => {
      console.error(msg, error);
    });
  },
});

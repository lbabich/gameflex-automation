import { Effect, Layer } from 'effect';
import type { ProcessError } from '../../errors';
import { ProcessExecutorService } from '../process-executor.service';

export const TestProcessExecutorService = (
  results: Array<Effect.Effect<{ code: number }, ProcessError>>,
): Layer.Layer<ProcessExecutorService> => {
  let callCount = 0;

  return Layer.succeed(ProcessExecutorService, {
    execute: () => {
      const next = results[callCount++];

      if (!next) {
        return Effect.die(new Error('TestProcessExecutorService: called more times than scripted'));
      }

      return next;
    },
  });
};

import { Effect } from 'effect';
import type { ChildProcessOutput } from '../../types';

export function parseSpinOutput(json: string) {
  return Effect.try({
    try: () => {
      const parsed: unknown = JSON.parse(json);

      if (!isChildProcessOutput(parsed)) {
        throw new Error('Invalid child process output shape');
      }

      return parsed;
    },
    catch: (error) => {
      return error instanceof Error ? error : new Error(String(error));
    },
  });
}

function isChildProcessOutput(val: unknown): val is ChildProcessOutput {
  if (typeof val !== 'object' || val === null) {
    return false;
  }

  const obj = val as Record<string, unknown>;

  return typeof obj.results === 'object' && obj.results !== null && Array.isArray(obj.errors);
}

import { Effect } from 'effect';
import type { ChildProcessOutput } from '../../types';

export type OutputParseError = { _tag: 'OutputParseError'; reason: string };

function parseSpinOutput(json: string): Effect.Effect<ChildProcessOutput, OutputParseError> {
  return Effect.try({
    try: () => {
      return JSON.parse(json) as unknown;
    },
    catch: () => {
      return { _tag: 'OutputParseError' as const, reason: 'invalid JSON' };
    },
  }).pipe(Effect.flatMap(validateShape));
}

function validateShape(val: unknown): Effect.Effect<ChildProcessOutput, OutputParseError> {
  if (typeof val !== 'object' || val === null) {
    return Effect.fail({ _tag: 'OutputParseError', reason: 'output is not an object' });
  }

  const obj = val as Record<string, unknown>;

  if (typeof obj.results !== 'object' || obj.results === null) {
    return Effect.fail({
      _tag: 'OutputParseError',
      reason: '"results" is missing or not an object',
    });
  }

  if (!Array.isArray(obj.errors)) {
    return Effect.fail({ _tag: 'OutputParseError', reason: '"errors" is missing or not an array' });
  }

  return Effect.succeed(val as ChildProcessOutput);
}

export const outputParser = { parseSpinOutput };

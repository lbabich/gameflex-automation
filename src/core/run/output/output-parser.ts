import { type Effect, type ParseResult, Schema } from 'effect';
import type { ChildProcessOutput } from '../../types';

const ChildProcessOutputSchema = Schema.parseJson(
  Schema.Struct({
    results: Schema.Object,
    errors: Schema.Array(Schema.Unknown),
  }),
);

function parseSpinOutput(json: string): Effect.Effect<ChildProcessOutput, ParseResult.ParseError> {
  return Schema.decodeUnknown(ChildProcessOutputSchema)(json) as unknown as Effect.Effect<
    ChildProcessOutput,
    ParseResult.ParseError
  >;
}

export const outputParser = { parseSpinOutput };

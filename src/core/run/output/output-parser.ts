import { type Effect, type ParseResult, Schema } from 'effect';
import type { ChildProcessOutput } from '../../types';

const TestStepSchema = Schema.Struct({
  title: Schema.String,
  duration: Schema.Number,
  status: Schema.Literal('passed', 'failed', 'warning', 'skipped'),
  optional: Schema.optional(Schema.Boolean),
  error: Schema.optional(Schema.String),
});

const InternalTestResultSchema = Schema.Struct({
  title: Schema.String,
  status: Schema.Literal('passed', 'failed', 'skipped', 'timedOut'),
  duration: Schema.Number,
  error: Schema.optional(Schema.String),
  failedStep: Schema.optional(Schema.String),
  logs: Schema.Array(Schema.String),
  steps: Schema.optional(Schema.Array(TestStepSchema)),
  gifUrl: Schema.optional(Schema.String),
  screenshotUrls: Schema.optional(Schema.Array(Schema.String)),
  screenshotPaths: Schema.optional(Schema.Array(Schema.String)),
});

const ChildProcessOutputSchema = Schema.parseJson(
  Schema.Struct({
    results: Schema.Struct({
      desktop: Schema.optional(InternalTestResultSchema),
      mobile: Schema.optional(InternalTestResultSchema),
    }),
    errors: Schema.Array(Schema.String),
  }),
);

function parseSpinOutput(json: string): Effect.Effect<ChildProcessOutput, ParseResult.ParseError> {
  return Schema.decodeUnknown(ChildProcessOutputSchema)(json);
}

export const outputParser = { parseSpinOutput };

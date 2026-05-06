# Plan: Subprocess Output Contract

## Problem

The game-session-automation subprocess writes a JSON blob; the parent process decodes it via Effect Schema. A seam exists but the schema is deliberately loose: `Schema.Object` for `results` and `Schema.Unknown` for `errors`. A change to the subprocess output — adding a field, changing a shape — isn't caught until runtime, buried in a `parseError` field on a finalized run.

Deletion test: remove the schema and finalization degrades gracefully to the same loose parsing. The schema is earning nothing.

## Solution

Define `ChildProcessOutput` as a strict Effect Schema in one shared location. Import it in runner.ts to validate before writing and in finalization to decode. The schema becomes load-bearing: mismatches surface immediately with structured `ParseError` context pointing to the exact field.

## Files

- `src/core/types.ts` or new `src/core/run/output-contract.ts` — define the strict schema
- `src/core/game-session-automation/runner.ts` — encode/validate output before writing
- Finalization service (wherever `OutputParser.parseSpinOutput` lives) — use the strict schema decoder
- `src/core/run/run-outputs/` — transient JSON files; schema must match their actual shape

## Steps

1. Audit the actual shape written by `runner.ts` — read a real `run-outputs/*.json` file to confirm field names and types.

2. Define `ChildProcessOutputSchema` in the chosen shared location:
   ```ts
   const TestResultSchema = Schema.Struct({
     title: Schema.String,
     status: Schema.Literal('passed', 'failed', 'skipped', 'timedOut'),
     duration: Schema.Number,
     error: Schema.optional(Schema.String),
     failedStep: Schema.optional(Schema.String),
     logs: Schema.Array(Schema.String),
     steps: Schema.Array(/* StepResultSchema */),
   });

   export const ChildProcessOutputSchema = Schema.parseJson(
     Schema.Struct({
       results: Schema.Record({
         key: Schema.Union(Schema.Literal('desktop'), Schema.Literal('mobile')),
         value: Schema.Union(Schema.Null, TestResultSchema),
       }),
       errors: Schema.Array(Schema.String),
     }),
   );

   export type ChildProcessOutput = Schema.Schema.Type<typeof ChildProcessOutputSchema>;
   ```

3. In `runner.ts` main(): after building the output object, call `Schema.encode` or validate via `Schema.decodeUnknown` before writing to the output file. This makes the subprocess self-validating.

4. In `OutputParser.parseSpinOutput`: replace the loose schema with the strict one. The `ParseError` context now points to the specific field that failed.

5. Run `npm run check`. Fix any type mismatches (they represent real contract gaps).

## Test Impact

- Tests of finalization can construct `ChildProcessOutput` values via `Schema.encode` rather than hand-crafting JSON strings.
- Invalid subprocess output is caught early with structured errors rather than silently producing a null-results run.

## Effort

Medium. Requires auditing the real JSON shape before writing the schema. ~2–4 hours.

# Plan: ProcessExecutorService Test Adapter

## Problem

`RunnerService` depends on `ProcessExecutorService` to spawn the Playwright child process. The Effect tag exists (a hypothetical seam), but there is only one adapter: the real subprocess. One adapter = hypothetical seam, not a real one.

Testing `RunnerService`'s orchestration logic — cancellation, fiber error handling, parse failures, partial results — requires launching an actual subprocess with a real browser. These paths are difficult to trigger reliably and slow to run.

Note: this plan has the most value once plans 02 (subprocess output schema) and 04 (state machine mutations) have landed, because the test adapter returns `ChildProcessOutput` values and the assertions target the state manager.

## Solution

Write a `TestProcessExecutorService` adapter that accepts a scripted `ChildProcessOutput` (or error) and resolves immediately. Use it in unit tests of `RunnerService` to cover all branches that matter.

## Files

- `src/core/run/process-executor.service.ts` — verify the Effect tag interface is clean (no extra dependencies leaking through)
- New: `src/core/run/test/test-process-executor.service.ts` — test adapter implementation
- New or updated: `src/core/run/runner.service.test.ts` — new test cases using the adapter

## Interface (what the adapter must satisfy)

```ts
// Existing interface the tag wraps:
type ProcessExecutor = {
  execute(args: RunArgs): Effect.Effect<ChildProcessOutput, ProcessError>;
};
```

The test adapter is constructed with a queue of `Effect.Effect<ChildProcessOutput, ProcessError>` results — one per `execute()` call:

```ts
const TestProcessExecutorService = (
  results: Array<Effect.Effect<ChildProcessOutput, ProcessError>>
): Layer.Layer<ProcessExecutorService> => { ... }
```

## Steps

1. Confirm `ProcessExecutorService` tag's interface is exactly `execute(args) → Effect<ChildProcessOutput, ProcessError>` — no extra filesystem or stream dependencies threaded through.

2. Write `TestProcessExecutorService` — dequeues a pre-scripted effect on each `execute()` call. Throws (Effect.die) if called more times than scripted.

3. Write test cases in `runner.service.test.ts`:
   - Happy path: adapter returns a valid `ChildProcessOutput` → run transitions to `completed`.
   - Parse error: adapter returns malformed JSON (or invalid schema) → run transitions to `error` with `parseError` set.
   - Process crash: adapter returns `Effect.fail(new ProcessError(...))` → run transitions to `error`.
   - Cancellation: cancel mid-flight → fiber is interrupted, run transitions to `cancelled`.

4. Run `npm run test:unit` to confirm new tests pass.

## Test Impact

Before: `RunnerService` orchestration logic has zero unit test coverage of error and cancellation paths.
After: all branches of the run lifecycle are covered by fast, in-process tests — no subprocess, no browser.

## Effort

Medium. Straightforward once plans 02 and 04 are done. ~2–4 hours. Best picked up last.

## Dependencies

- Plan 02 (subprocess output schema) — adapter returns typed `ChildProcessOutput`
- Plan 04 (state machine) — assertions target `stateManager.snapshot()` for clean validation

# Plan: RunRecord Mutations Through the State Machine

## Problem

`RunStateManager` defines a lifecycle state machine (via `runTransition`) for run status. But finalization and the media pipeline mutate `results` and `screenshotUrls` directly on the `InternalRunRecord` object — bypassing the state machine entirely.

Run state has two owners: the state manager (for status) and finalization (for payload). Deletion test: remove `RunStateManager.finalize()` and finalization still works by patching the record directly. The state machine is not earning the record mutations — it's a partial enforcer.

This makes it impossible to answer "what does a run record look like at each lifecycle stage?" by reading RunStateManager alone.

## Solution

Route all `InternalRunRecord` mutations through RunStateManager. Finalization calls explicit mutation methods (`attachResults`, `attachMedia`) rather than patching the object in place. RunStateManager owns both status transitions and payload updates. Records become immutable outside the state manager.

## Files

- `src/core/run/run-state.manager.ts` — add `attachResults(runID, results)` and `attachMedia(runID, mediaResult)` methods; make record storage return frozen/readonly snapshots
- `src/core/run/run-finalization.service.ts` — replace direct record mutation with state manager calls
- `src/core/run/media.ts` — remove URL side-effects from record; return URLs for caller to attach via state manager
- `src/core/run/runner.service.ts` — update finalization call sites
- `src/core/types.ts` — consider making `InternalRunRecord` fields `readonly`

## Steps

1. Add methods to `RunStateManager`:
   ```ts
   attachResults(runID: RunID, results: Record<DeviceType, TestResult | null>): Effect.Effect<void, RunNotFoundError>
   attachMedia(runID: RunID, mediaResult: MediaResult): Effect.Effect<void, RunNotFoundError>
   ```
   Each method calls `runTransition.transition(current, { type: 'ResultsAttached' | 'MediaAttached', ... })` and stores the new record.

2. Refactor `run-finalization.service.ts` — after parsing subprocess output, call `stateManager.attachResults(...)`. After media pipeline, call `stateManager.attachMedia(...)`. Remove direct record mutation.

3. Refactor `media.ts` — `attachScreenshotUrls` returns URLs rather than side-effecting onto the record. Caller passes them to `stateManager.attachMedia`.

4. Add `readonly` to `InternalRunRecord` fields in `src/core/types.ts` to make the compiler enforce the new ownership.

5. Run `npm run check` — fix any sites that were mutating the record directly.

6. Update `runner.service.test.ts` — assert on state manager snapshots rather than on mutable record fields.

## Test Impact

- Finalization tests assert on `stateManager.snapshot()` rather than inspecting a mutable object.
- The full lifecycle of a run record is readable by reading RunStateManager alone.
- The `readonly` enforcement means future contributors can't accidentally add new mutation sites.

## Effort

Medium-large. Touches finalization, media, and state manager. Needs careful sequencing — finalization calls media which returns URLs. ~half day.

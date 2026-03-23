# PRD: GEL Event-Based Game Load Detection

## Problem Statement

The automation suite currently uses a fixed 8-second blind wait after `page.goto()` before attempting to discover the spin button or replay cached steps. This is fragile: fast-loading games waste time, slow or broken games proceed without any signal that they are actually ready, and there is no record of how long a game actually took to load. The suite has no way to distinguish between a game that is still loading and one that has fully initialised.

## Solution

Replace the blind 8-second wait with event-driven load detection using two console events emitted by the GEL game engine:

- `gel.load.progress {"percent": N}` — signals that a game has started loading. We cannot rely on this reaching 100%, but its presence confirms the engine is alive and initialising.
- `gel.ready` — signals that the game is fully loaded and ready for interaction. This is the authoritative gate before any click discovery or replay can begin.

If `gel.ready` does not fire within 10 seconds of page navigation, the test is hard-failed as a slow load. The actual load time (from navigation to `gel.ready`) and whether `gel.load.progress` was received are both recorded as Playwright test annotations on every run.

## User Stories

1. As a test engineer, I want the suite to wait for `gel.ready` before starting discovery, so that Claude Vision is never called against a half-loaded game screen.
2. As a test engineer, I want the suite to wait for `gel.ready` before starting step replay, so that cached clicks are not sent to a game that hasn't initialised yet.
3. As a test engineer, I want the test to hard-fail with a clear error if `gel.ready` doesn't fire within 10 seconds, so that broken or very slow games are flagged immediately rather than silently retried.
4. As a test engineer, I want the load time (ms from navigation to `gel.ready`) recorded as a Playwright annotation on every test run, so that load performance trends are visible in the test report.
5. As a test engineer, I want to know whether at least one `gel.load.progress` event was received, recorded as a Playwright annotation, so that I can distinguish between a game that loaded silently and one that emitted progress events as expected.
6. As a test engineer, I want the old 8-second blind wait removed from both discovery and replay, so that the suite does not waste time waiting when the game is already ready.
7. As a test engineer, I want the `gel.ready` timeout to be defined as a named constant, so that it can be adjusted without hunting through code.
8. As a test engineer, I want the game-ready logic to live in a single shared module, so that discovery and replay always behave consistently and the logic only needs to be maintained in one place.
9. As a test engineer, I want the `SlowLoadError` to include the elapsed time in its message, so that the failure report gives me an immediate indication of how long the game was waited for.
10. As a test engineer, I want `waitForGameReady` to begin timing from the moment it is called, so that the recorded load time accurately reflects the game's actual startup duration rather than any harness overhead.
11. As a test engineer, I want the suite to continue working correctly for games that have already been discovered and cached, so that replay is not broken by this change.
12. As a test engineer, I want the suite to continue working correctly for games running in real-money mode, so that the load detection works regardless of playmode.

## Implementation Decisions

### New module: `gel-events` (src/lib/)

A new shared library module responsible for all GEL event detection logic. Exports:

- **`GEL_EVENT`** constant — string keys for `LOAD_PROGRESS` (`gel.load.progress`) and `READY` (`gel.ready`)
- **`GEL_READY_TIMEOUT_MS`** constant — 10,000ms; hard-fails if `gel.ready` is not received in time
- **`GameReadyResult`** type — `{ loadTimeMs: number; hadLoadProgress: boolean }`
- **`SlowLoadError`** — thrown when the timeout elapses; message includes elapsed milliseconds
- **`waitForGameReady(page)`** — async function that:
  1. Records start time
  2. Begins listening for any `gel.load.progress` event (sets `hadLoadProgress = true`)
  3. Awaits `gel.ready` via `page.waitForEvent('console', { predicate, timeout: GEL_READY_TIMEOUT_MS })`
  4. On timeout: throws `SlowLoadError` with elapsed time
  5. On success: returns `GameReadyResult`

The predicate for `gel.load.progress` checks that the console message text starts with `GEL_EVENT.LOAD_PROGRESS`. The predicate for `gel.ready` checks that the message text includes `GEL_EVENT.READY`.

### Modified: `discovery` module (src/lib/)

- Remove `DISCOVERY_INITIAL_WAIT_MS` constant and the `page.waitForTimeout(DISCOVERY_INITIAL_WAIT_MS)` call
- Accept the `waitForGameReady` result (or call it directly) before the discovery loop begins
- `discoverSteps` receives or internally calls `waitForGameReady` and returns the `GameReadyResult` alongside the discovered steps so the caller can annotate the load time

### Modified: `replay` module (src/lib/)

- Call `waitForGameReady(page)` before the step replay loop begins
- Return the `GameReadyResult` to the caller so load time can be annotated

### Modified: test harness (src/tests/game-spin.spec.ts)

- After navigation and before the discovery/replay branch, call `waitForGameReady` (or receive the result from discovery/replay) and add two Playwright annotations:
  - `load-time-ms`: the numeric load time in milliseconds
  - `had-load-progress`: `"true"` or `"false"` depending on whether `gel.load.progress` was received
- `SlowLoadError` propagates naturally as an unhandled exception, failing the test

### Removed

- `DISCOVERY_INITIAL_WAIT_MS` constant in `discovery.ts` — no longer needed
- The `page.waitForTimeout(DISCOVERY_INITIAL_WAIT_MS)` call at the start of `discoverSteps`
- Any equivalent fixed initial wait that existed in `replay.ts`

## Testing Decisions

**What makes a good test here:** test the external behaviour of `waitForGameReady` — what it returns, when it throws, and what the caller receives. Do not test implementation details like internal timer variables or listener registration.

### Module to test: `gel-events`

This is a pure, isolated function that only depends on a Playwright `Page` interface. It is the highest-value test target.

Test cases:
- `gel.ready` fires promptly → returns correct `loadTimeMs` (> 0) and `hadLoadProgress: false`
- `gel.load.progress` fires before `gel.ready` → `hadLoadProgress: true`
- `gel.ready` never fires within timeout → throws `SlowLoadError` with elapsed time in message
- `loadTimeMs` reflects the actual elapsed time, not zero or a hardcoded value

Prior art: `src/tests/unit/` — existing unit tests use Vitest with no mocking framework. The Playwright `Page` can be replaced with a minimal stub that fires console events on demand.

### Module not unit tested: `discovery`, `replay`, `game-spin.spec.ts`

These are integration-level concerns. The `waitForGameReady` logic is fully tested in isolation; the integration of the call into discovery/replay is verified by the existing Playwright end-to-end test (`game-spin.spec.ts`).

## Out of Scope

- Using `gel.load.progress` percent values to drive any wait behaviour — the percent is not reliably tracked and `gel.ready` is the authoritative signal
- Emitting warnings for games where `gel.load.progress` is never seen but `gel.ready` fires — this can be a follow-up once the annotation data is collected across several runs
- Configuring the `GEL_READY_TIMEOUT_MS` per-game — a single constant is sufficient for now
- Retrying navigation if a slow load is detected — the test hard-fails; retry strategy is a separate concern

## Further Notes

- The `gel.load.progress` format is `gel.load.progress {"percent": N}` — detection should check `msg.text().startsWith('gel.load.progress')` rather than an exact match so that the JSON payload variations don't cause misses.
- The `gel.ready` event is a plain string with no payload — `msg.text().includes('gel.ready')` is sufficient.
- Both events may fire before Playwright's console listener is registered if navigation is very fast. The listener should be attached before `page.goto()` in the test harness, or `waitForGameReady` should be called immediately after navigation begins. The current architecture (goto → waitForGameReady) is acceptable because `gel.ready` typically fires 2–8 seconds after navigation; if edge cases appear on very fast machines a pre-navigation listener can be added as a follow-up.
- Load time data collected via the annotation will inform whether the 10-second threshold needs adjustment for specific game providers.

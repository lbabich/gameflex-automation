# Plan: Extract `GameSession` Module

## Problem

`runner.ts` is the subprocess entry point for `game-session-automation`. It is the most complex
module in the system, but it has no callable interface — it is a script that can only be exercised
by spawning a child process. Its internal logic (`runGame`, `executeSteps`, `buildSessionContext`,
`buildResult`) is entirely private.

This means:
- You cannot write a unit or integration test for session execution without spawning a process
- The session orchestration logic (`discover → check cache → replay → run step → collect results`)
  is invisible at any seam — it can only be verified through full E2E runs
- All 8 module imports (`screenshot`, `accumulator`, `replay`, `stepRegistry`, `tracker`,
  `claudeVisionAnalyzer`, `cache`, `disk`) are entangled with CLI parsing in the same file

Deletion test applied: if you deleted `runner.ts`, the eight imported modules would still exist
but with no way to coordinate them. The coordination logic is earning its keep — it just needs
to live behind a seam.

## Solution

Extract a `GameSession` module from `runner.ts`. The module exports a single function:

```
gameSession.run(context, options): Promise<InternalTestResult>
```

where `context` carries the Playwright `Page` and identity fields (`game`, `deviceType`,
`viewport`), and `options` carries the run configuration (`runID`, `steps`, `hints`, `cache`).

The runner entry point (`runner.ts`) becomes a thin CLI harness:
1. Parse args
2. Launch browser
3. Loop over games × device types → call `gameSession.run()`
4. Collect results → write output file

`gameSession.ts` owns: `openSession`, `buildSessionContext`, `executeSteps`, `buildResult`,
and the snapshot helpers (`takePostRunSnapshots`, `takeFailureSnapshots`, `snapSequence`).

## Files Affected

| Action | File |
|--------|------|
| New    | `src/core/game-session-automation/game-session.ts` |
| Modify | `src/core/game-session-automation/runner.ts` — shrinks to ~50 lines (parse + browser + loop) |

## What Changes

### `game-session.ts` (new)

Exports:
```ts
export type GameSessionContext = {
  page: Page;
  game: GameEntry;
  deviceType: DeviceType;
  viewport: Viewport;
};

export type GameSessionOptions = {
  runID: string;
  steps: Step<FullStepContext>[];
  hints: RunHints;
  cache: NodeStepCache;
};

export const gameSession = {
  run: (ctx: GameSessionContext, opts: GameSessionOptions): Promise<InternalTestResult>
};
```

Internally contains: `executeSteps`, `buildResult`, `takePostRunSnapshots`,
`takeFailureSnapshots`, `snapSequence`, `buildSessionContext`.

### `runner.ts` (slimmed)

After the split, `runner.ts` contains only:
- `main()`: parse args → create cache → resolve steps → launch browser → loop → write output
- `openSession()`: creates a `BrowserContext` and `Page`
- `parseArgs()`

`runner.ts` calls `gameSession.run()` per game/device combination and no longer imports
`replay`, `tracker`, `stepRegistry` (plan/merge), `accumulator`, or `screenshot` directly.

## Key Invariants Preserved

- The subprocess protocol (CLI args, base64 encoding, output file) is unchanged
- `executeSteps` logic is unchanged — same discover → cache-check → replay → run sequence
- No new dependencies introduced; the 8 existing imports just move to `game-session.ts`
- `openSession` stays in `runner.ts` because it needs the `Browser` instance that only
  the CLI harness holds

## Testability After

`gameSession.run()` can be called in a test with:
- A real or mock Playwright `Page`
- A `TestStepCache` in-memory stub
- Controlled step sequences

This makes the session execution logic testable without spawning a subprocess — the first time
that's possible in this codebase.

## Work Estimate

Small-medium. No new logic. Pure extraction + type alignment. The two types
(`GameSessionContext`, `GameSessionOptions`) already exist implicitly as `GameRunContext` and
`GameRunOptions` in runner.ts — this plan just exports them.

## Open Questions (for grilling)

1. ~~Should `openSession` move into `game-session.ts`?~~ **Decided: yes — Option B.**
   `gameSession.run(browser, game, deviceType, viewport, options)` owns open + run + close.
   Runner holds only the shared `Browser`. `openSession` moves into `game-session.ts`.

2. ~~Should `visionAnalyzer` be hardwired or a parameter?~~ **Decided: Option B — parameter.**
   `gameSession.run(context, options, visionAnalyzer)` accepts the analyzer explicitly.
   `runner.ts` imports `claudeVisionAnalyzer` and passes it at the call site.
   `game-session.ts` has no Anthropic SDK import.

3. ~~Where should `claudeVisionAnalyzer` live after the split?~~ **Resolved by Q2.**
   The import stays in `runner.ts` (the entry point), wired at call time.

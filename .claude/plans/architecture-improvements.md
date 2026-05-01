# Architecture Improvements Plan

Six deepening opportunities identified via `/improve-codebase-architecture`. Work through them in order — each is independent unless noted.

---

## 1. Step Cache: injectable store

**Goal:** Break the hard filesystem dependency so tests use an in-memory store instead of real disk I/O.

**Files touched:**
- `src/server/lib/step-cache.ts` — add `createStepCache(store)` factory; keep module-level default using disk
- `src/server/lib/step-store.ts` — new file: `StepStore` type, `createDiskStore()`, `createMemoryStore()`
- `src/server/services/games.service.ts` — add `getCachedDeviceMap` here (moved from step-cache); call `stepCache.loadAll()` to derive the map
- `src/server/tests/step-cache.test.ts` — replace real-file fixtures with `createMemoryStore()`
- `src/server/tests/games-step-cache.test.ts` — replace real-file fixtures with `createMemoryStore()`
- `src/server/tests/games.service.test.ts` — update `getCachedDeviceMap` test to use the service-level implementation

**Steps:**
1. Create `src/server/lib/step-store.ts` with:
   - `type StepStore = { load(): StepCache; save(cache: StepCache): void }`
   - `createDiskStore(): StepStore` — wraps current `loadCache` / `saveCache` logic
   - `createMemoryStore(initial?: StepCache): StepStore` — plain object, no I/O
2. Refactor `step-cache.ts`:
   - Extract `loadCache` / `saveCache` into `createDiskStore` (move to step-store.ts)
   - Add `createStepCache(store: StepStore)` factory that returns all current functions, using the injected store for all reads/writes; `pending` Map lives inside the factory closure
   - Add `loadAll(): StepCache` to the returned object (used by `games.service.ts` for `getCachedDeviceMap`)
   - Keep module-level default export (`getSteps`, `setSteps`, etc.) backed by `createDiskStore()` — zero callsite changes in production code
   - Remove `getCachedDeviceMap` from the module-level exports (it moves to `games.service.ts`)
3. Move `getCachedDeviceMap` to `games.service.ts`:
   - Add a `loadAll` call on `stepCache` and derive the map inline
   - Remove `getCachedDeviceMap` from `GamesService` interface (per Candidate 2 — step-cache methods don't belong on GamesService) — wait, actually `getCachedDeviceMap` is a read query on the cache that the games route uses. It moves *into* `games.service.ts` as a method that calls `stepCache.loadAll()` and derives from it. Keep it on the `GamesService` interface since the route uses `gamesService.getCachedDeviceMap()`.
4. Update tests:
   - `step-cache.test.ts`: construct `createStepCache(createMemoryStore())` — remove all `fs` setup/teardown
   - `games-step-cache.test.ts`: same pattern — remove temp file fixtures
   - `games.service.test.ts`: update `getCachedDeviceMap` test if needed

**Invariants to preserve:**
- `saveToCache()` (commit pending) remains explicit — caller still calls it
- Module-level default instance behaviour is identical to before
- `StepCacheKey` type remains exported

---

## 2. `GamesService`: remove step-cache methods from interface

**Goal:** `GamesService` becomes a pure game-CRUD interface. Step-cache operations move to direct calls at the route level.

**Files touched:**
- `src/server/services/games.service.ts` — remove `clearAllSteps`, `clearSteps` methods
- `src/server/routes/games.ts` — call `stepCache` directly for clear operations (sync, no Effect wrapper needed)
- `src/server/tests/runner.service.test.ts` — remove `clearAllSteps` / `clearSteps` from the test stub

**Steps:**
1. Remove `clearAllSteps` and `clearSteps` from the `GamesService` tag interface and `NodeGamesService` implementation
2. In `routes/games.ts`, import `* as stepCache` and call `stepCache.clearAllSteps(id)` / `stepCache.clearChannelSteps(id, channel)` directly inside the route handlers (wrap in `Effect.sync` for consistency with the surrounding Effect pipeline)
3. Remove the two stubbed methods from `makeTestRuntime` in `runner.service.test.ts`

**Note:** `getCachedDeviceMap` stays on `GamesService` — it's a legitimate read query the games route needs. It just gets its implementation from `stepCache.loadAll()` after Candidate 1.

---

## 3. Break `games.ts` ↔ `step-cache` direct coupling

**Goal:** `lib/games.ts` no longer imports `step-cache`. Cache invalidation moves to the caller.

**Files touched:**
- `src/server/lib/games.ts` — `updateGame` and `deleteGame` return `{ idChanged: boolean }` instead of `void`; remove `stepCache` import
- `src/server/services/games.service.ts` — after calling `updateGame` / `deleteGame`, check the flag and call `stepCache.clearAllSteps(id)` if needed
- `src/server/tests/games.service.test.ts` — add/update tests for invalidation behaviour
- `src/server/tests/games-step-cache.test.ts` — tests now test service-level invalidation, not lib-level

**Steps:**
1. Change `updateGame` return type to `{ idChanged: boolean }` — return the flag instead of calling `stepCache.clearAllSteps`; remove the `stepCache` import from `games.ts`
2. Change `deleteGame` return type to `{ idChanged: true }` (always true — a deleted game always invalidates)
3. In `games.service.ts` `update` handler: after `games.updateGame(id, updates)`, if `result.idChanged`, call `stepCache.clearAllSteps(id)` (sync, wrapped in `Effect.sync`)
4. In `games.service.ts` `delete` handler: after `games.deleteGame(id)`, call `stepCache.clearAllSteps(id)`
5. Update `games-step-cache.test.ts` to test through the service layer instead of `lib/games` directly

---

## 4. `RunnerService`: injectable `ProcessExecutor`

**Goal:** `spawnProcess` becomes injectable so tests can drive the full finalization path without spawning real subprocesses.

**Files touched:**
- `src/server/services/runner/process.ts` — extract `ProcessExecutor` type; `spawnProcess` becomes the production adapter
- `src/server/services/runner/runner.service.ts` — depend on `ProcessExecutor` Effect tag instead of importing `spawnProcess` directly
- `src/server/runtime.ts` — provide `NodeProcessExecutor` layer
- `src/server/tests/runner.service.test.ts` — inject a fake `ProcessExecutor` that returns pre-baked stdout; add finalization tests

**Steps:**
1. In `process.ts`, add:
   - `type ProcessExecutor = { execute(cmd: string): Effect.Effect<{ code: number; stdout: string }> }`
   - `class ProcessExecutorTag extends Effect.Tag('ProcessExecutor')<ProcessExecutorTag, ProcessExecutor>()`
   - `NodeProcessExecutor = Layer.succeed(ProcessExecutorTag, { execute: (cmd) => spawnProcess(cmd) })`
2. In `runner.service.ts`:
   - Replace `import { spawnProcess } from './process'` with `import { ProcessExecutorTag } from './process'`
   - In `NodeRunnerService` factory, `yield* ProcessExecutorTag` and pass the executor down to `startRun`
   - Replace `spawnProcess(cmd)` call with `executor.execute(cmd)`
3. In `runtime.ts`, add `NodeProcessExecutor` to the layer merge
4. In `runner.service.test.ts`:
   - Add a `testProcessExecutor` layer in `makeTestRuntime` that returns `{ code: 0, stdout: '{"results":{},"errors":[]}' }` by default
   - Add tests for finalization: completed run, error exit code, parse failure
   - Remove the dangling-subprocess problem as a side effect

---

## 5. Screenshot path constant

**Goal:** `SCREENSHOTS_DIR` defined once, imported by the two other modules that use it.

**Files touched:**
- `src/server/lib/screenshot.ts` — export `SCREENSHOTS_DIR` constant
- `src/server/lib/gif-generator.ts` — import and use `SCREENSHOTS_DIR`
- `src/server/services/runner/media.ts` — import and use `SCREENSHOTS_DIR`

**Steps:**
1. In `screenshot.ts`, replace the inline `path.resolve('src/server/screenshots', ...)` with:
   ```typescript
   export const SCREENSHOTS_DIR = path.resolve('src', 'server', 'screenshots');
   ```
   and use it in `snap()`
2. In `gif-generator.ts`, import `SCREENSHOTS_DIR` from `../lib/screenshot` and replace the inline `path.resolve('src/server/screenshots', ...)` usage
3. In `media.ts`, import `SCREENSHOTS_DIR` from `../lib/screenshot` and replace the inline usage

---

## 6. Unknown steps throw in `test-runner.ts`

**Goal:** A misspelled or unknown step name surfaces as a run error, not a silent omission.

**Files touched:**
- `src/server/scripts/test-runner.ts` — throw instead of warn on unknown step

**Steps:**
1. In `test-runner.ts`, change the unknown-step handler from:
   ```typescript
   console.warn(`[test-runner] Unknown step '${name}' — skipping`);
   return [];
   ```
   to:
   ```typescript
   throw new Error(`Unknown step '${name}' — valid steps: ${Object.keys(STEP_REGISTRY).join(', ')}`);
   ```
2. Remove the `flatMap` wrapper (now a plain `map` since there's no empty-array case)
3. Verify `main()` catch handler propagates this correctly to `process.exit(1)`

---

## Sequence

Work in order. Each candidate is independent except:
- Candidate 2 depends on Candidate 1 completing first (needs `stepCache.loadAll()` for `getCachedDeviceMap`)
- Candidate 3 depends on Candidate 2 completing first (invalidation logic moves into `games.service.ts`)

So the safe order is: **1 → 2 → 3 → 4 → 5 → 6**

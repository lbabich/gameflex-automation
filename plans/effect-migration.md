# Migrate src/server/ to Effect

## Problem Statement

The `src/server/` layer relies on a set of patterns that make the code hard to test, error paths invisible in types, and service dependencies implicit. Specifically:

- `runner.ts` holds three module-level mutable `Map`s as global state, making it impossible to test run lifecycle in isolation without side effects leaking between tests.
- Route handlers in `routes/games.ts` contain 10+ scattered `typeof` / `Array.includes` validation checks that produce no types and duplicate logic across endpoints.
- Errors thrown by `lib/games.ts` (e.g. "already exists", "not found") surface as plain `Error` objects caught by generic `catch(err)` blocks — there is no type-level indication of what can fail.
- `runner.ts` cancels processes by keeping a `Map<string, ChildProcess>` and calling `.kill()` imperatively; if the process record and the cancellation path diverge, cleanup silently fails.
- Environment variables (`CORS_ORIGIN`, `GAME_URL`, `ANTHROPIC_API_KEY`) are read inline with `process.env` at call-site, meaning a missing variable is only discovered at request time, not at startup.

## Solution

Migrate `src/server/` to [Effect](https://effect.website), keeping Express as the HTTP layer. Express route handlers become thin adapters that call `runtime.runPromise(effect)` at the boundary. All business logic moves into four typed service Layers: `ConfigService`, `FileService`, `GamesService`, and `RunnerService`. Request body validation moves to Effect Schema. All error paths become typed discriminated unions, navigable with `Effect.catchTag`. A new `docs/effect-reference.md` serves as a living reference table for every Effect primitive introduced.

## Commits

### 1 — `chore: install effect`
Add `effect` to `dependencies` in `package.json`. No code changes. Verify `npm install` succeeds.

### 2 — `feat: add typed server error classes`
Create `src/server/errors.ts`. Define one `Data.TaggedError` subclass per named failure mode:

- `GameNotFoundError` — a game GUID was not found in the registry
- `DuplicateGameIdError` — adding a game whose `desktopGameId` already exists
- `RunNotFoundError` — a runId is not in the active or recent runs
- `RunAlreadyActiveError` — attempting to start a run for a game already running
- `ParseError` — JSON report parsing failed
- `FileReadError` — `fs.readFileSync` threw
- `FileWriteError` — `fs.writeFileSync` threw
- `ConfigError` — a required env var is absent

No other files change. The codebase compiles and tests pass.

### 3 — `docs: add Effect primitives reference`
Create `docs/effect-reference.md` as an empty reference table with the columns: **Primitive**, **What it does**, **When to reach for it**, **Example from this project**. Subsequent commits fill in each row as the primitive is introduced. This file is the reader's companion to the code.

### 4 — `feat: add FileService Layer`
Create `src/server/services/file.ts`.

Interface:
- `read(path: string): Effect<string, FileReadError>`
- `write(path: string, content: string): Effect<void, FileWriteError>`
- `exists(path: string): Effect<boolean>`

`FileServiceLive` wraps the three `node:fs` sync calls in `Effect.try`. Not wired into the app yet — the file compiles but nothing imports it. Update `effect-reference.md` with: `Effect.Tag`, `Layer.effect`, `Effect.try`.

### 5 — `feat: add ConfigService Layer`
Create `src/server/services/config.ts`.

Interface:
- `corsOrigin: string`
- `gameUrl: string`
- `anthropicApiKey: string`

`ConfigServiceLive` uses `Config.string()` with `Config.withDefault` for optional vars. The Layer fails at construction time if a required var is missing, so the server refuses to start rather than silently serving broken requests. Not wired yet. Update `effect-reference.md` with: `Config.string`, `Config.withDefault`.

### 6 — `feat: add GamesService Layer`
Create `src/server/services/games.ts`.

Interface:
- `list(): Effect<GameEntry[]>`
- `add(input): Effect<GameEntry, DuplicateGameIdError>`
- `update(id, patch): Effect<GameEntry, GameNotFoundError>`
- `clearSteps(id, channel): Effect<void, GameNotFoundError>`
- `clearAllSteps(id): Effect<void, GameNotFoundError>`

Each method wraps the corresponding `lib/games.ts` and `lib/step-cache.ts` function in `Effect.try`, mapping thrown errors to the typed domain errors from commit 2. Does not depend on `FileService` (lib/games.ts manages its own file path internally — threading FileService through lib/ is out of scope). Not wired yet. Update `effect-reference.md` with: `Effect.gen`, `Effect.succeed`, `Effect.fail`.

### 7 — `feat: add RunnerService Layer`
Create `src/server/services/runner.ts`. This replaces the module-level state in `runner.ts`.

Interface:
- `startRun(gameIds: string[]): Effect<RunRecord, RunAlreadyActiveError | GameNotFoundError>`
- `cancelRun(runId: string): Effect<void, RunNotFoundError>`
- `getRun(runId: string): Effect<RunRecord, RunNotFoundError>`
- `getRecentRuns(): Effect<RunRecord[]>`

The three `Map`s (runs, activeRunsByGame, activeFibers) live inside the Layer closure — not module globals. `startRun` uses `Effect.forkDaemon` to spawn the test process as a background fiber. The background fiber wraps the `spawn` lifecycle in `Effect.async`: its cleanup function (returned by the `Effect.async` callback) calls `proc.kill()`, which fires automatically when the fiber is interrupted via `cancelRun`. This replaces the `activeProcessesByRunId` Map: instead of storing the `ChildProcess`, we store the `Fiber`, and `cancelRun` calls `Fiber.interrupt`. `FileService` is used to read/write `runs.json`. Not wired yet. Update `effect-reference.md` with: `Effect.async`, `Effect.forkDaemon`, `Fiber.interrupt`.

### 8 — `feat: build AppLayer and ManagedRuntime; wire into index.ts`
Create `src/server/runtime.ts`. Compose the four Live Layers into `AppLayer`. Call `ManagedRuntime.make(AppLayer)` to produce a shared `AppRuntime`. Export the runtime type for use in route factories.

Update `src/server/index.ts`:
- `await Runtime.make()` before `app.listen()`
- Convert each `app.use` call to a factory: `app.use('/api/games', makeGamesRouter(runtime))`

Route factory functions accept `runtime: AppRuntime` as a parameter but do not yet use it — route handlers still call the old modules directly. The app boots and all existing routes respond correctly. Update `effect-reference.md` with: `ManagedRuntime`, `Effect.runPromise`.

### 9 — `refactor: migrate routes/games.ts to GamesService and Schema`
Convert every route handler in `routes/games.ts` to:
1. Parse the request body with `Schema.decodeUnknown(BodySchema)(req.body)` inside `Effect.gen`
2. Call the appropriate `GamesService` method
3. Map typed errors to HTTP status codes with `Effect.catchTag`
4. Run the whole effect with `runtime.runPromise(...).then(result => res.json(result)).catch(err => res.status(500).json(...))`

Replace all manual `typeof` and `Array.includes` validation. Define Schema structs for each endpoint's request body at the top of the file. Update `effect-reference.md` with: `Schema.Struct`, `Schema.decodeUnknown`, `Effect.catchTag`.

### 10 — `refactor: migrate routes/runs.ts to RunnerService`
Convert the three run route handlers to use `RunnerService` via `runtime.runPromise`. Remove the direct `runner.ts` imports from `routes/runs.ts`. The original `runner.ts` is left in place but is no longer imported by routes.

### 11 — `refactor: migrate report-parser.ts to Effect`
Wrap `extractReportJson` and `parseJsonReport` return values in `Effect.try`, surfacing `ParseError` on failure. Update the call sites in `RunnerService`. Update `src/tests/unit/report-parser.test.ts` to call `Effect.runSync` when invoking the two functions directly.

### 12 — `test: add GamesService and RunnerService unit tests`
Add `src/tests/unit/games-service.test.ts`:
- Drives through `GamesService` methods using a real disk (same save/restore pattern as `games.test.ts`)
- Verifies typed errors: adding a duplicate returns `DuplicateGameIdError`, not a thrown string

Add `src/tests/unit/runner-service.test.ts`:
- Uses `TestFileService` (`Layer.succeed(FileService, { read: ..., write: ..., exists: ... })` with in-memory state) so no disk access
- Uses a fake spawn function that resolves immediately with a canned Playwright JSON report
- Covers: start returns a `running` record; starting same game twice returns `RunAlreadyActiveError`; cancel interrupts the fiber; completed run writes to the in-memory FileService

## Decision Document

**Express stays.** `@effect/platform` HTTP server is not adopted in this pass. Effect handles business logic; Express handles HTTP. The Effect boundary is `runtime.runPromise(effect)` inside each route handler.

**`Effect.gen` throughout.** Generator style for all multi-step Effects. `pipe` is used only for simple single-step transforms on existing values where `gen` would add noise.

**`Data.TaggedError` for errors.** Each error class extends `Data.TaggedError("ErrorName")`. This gives each error a `_tag` discriminant that `Effect.catchTag` matches on, enabling exhaustive error routing at route handlers without `instanceof` checks.

**`FileService` scope is limited.** `FileService` is only used by `RunnerService` for `runs.json`. The `lib/games.ts` module (which manages `games.json`) is not refactored to use `FileService` in this pass. `GamesService` wraps `lib/games.ts` with `Effect.try`. Wiring `FileService` through `lib/` is a future step when `src/lib/` is migrated.

**State stays as plain `Map`s.** `RunnerService`'s in-memory Maps are regular mutable Maps captured in the Layer closure — not `Ref` or `SynchronizedRef`. The server is single-process and non-concurrent at the Map level; using `Ref` would add complexity without a concrete benefit here.

**Cancellation via fiber interruption.** `cancelRun` calls `Fiber.interrupt(fiber)` instead of `proc.kill()` directly. The process kill happens automatically via the cleanup function returned by `Effect.async`. This removes the `activeProcessesByRunId` Map.

**`ManagedRuntime` created once at startup.** A single `AppRuntime` is shared across all requests. Layers are constructed once. Avoids per-request Layer rebuilds.

**Schema lives in route files.** Request body Schemas are defined at the top of each route file. No separate `schemas/` directory — they're small and local to one file.

**Route factories.** Each router export becomes `makeXRouter(runtime: AppRuntime): Router`. This makes the runtime dependency explicit and injectable in tests if needed.

## Testing Decisions

**What makes a good test:** Test the observable contract of a service — what it returns, what errors it produces, what side effects it causes — not how it achieves the result. Do not assert that specific Effect combinators were called.

**GamesService tests** (`games-service.test.ts`): Integration-style, hit disk. Follow the `beforeAll` save / `afterAll` restore pattern from `games.test.ts`. The new tests drive through `GamesService` via `Effect.runPromise` with `GamesServiceLive`. Verify that the typed errors (`DuplicateGameIdError`, `GameNotFoundError`) are returned rather than thrown.

**RunnerService tests** (`runner-service.test.ts`): Pure unit tests. Use `TestFileService` built with `Layer.succeed` (in-memory, no disk) and a `TestProcessService` that resolves a fake Playwright JSON report immediately. Verify run lifecycle: `startRun` → `running` status, same-game conflict → `RunAlreadyActiveError`, `cancelRun` → run removed from active map, process kill cleanup fires.

**report-parser.test.ts**: Updated minimally — call `Effect.runSync` instead of calling functions directly. No new test cases added.

**Prior art:** `src/tests/unit/games.test.ts` (disk-backed), `src/tests/unit/report-parser.test.ts` (pure). New tests use the same `vitest` `describe`/`it`/`expect` conventions and live in `src/tests/unit/`.

## Out of Scope

- `src/dashboard/` — React frontend. Effect adoption there is a separate follow-up.
- `src/lib/` — `lib/games.ts`, `lib/step-cache.ts`, `lib/claude-vision.ts`, etc. are not Effect-ified. `GamesService` wraps them with `Effect.try`.
- `@effect/platform` HTTP server — Express stays.
- Effect `Ref` / `SynchronizedRef` for state — plain Maps inside Layer closure.
- OpenTelemetry / Effect tracing and metrics.
- `routes/screenshots.ts` — the `sendFile` path safety check is left as-is; no meaningful Effect wins there.
- `url-builder.ts` — pure function with no errors or side effects; no Effect needed.

## Further Notes

`docs/effect-reference.md` is introduced in commit 3 and updated incrementally with each subsequent commit as new primitives are introduced. By the end of commit 12, it will contain every Effect primitive used in this codebase with: what it does, when to reach for it, and a concrete in-project example. It is the intended first stop for anyone reading this code without prior Effect experience.

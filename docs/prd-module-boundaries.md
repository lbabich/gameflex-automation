# PRD: Establish Clear Module Boundaries

## Problem Statement

The codebase has grown to a point where module responsibilities are unclear and layer boundaries are violated in three concrete ways:

1. **Layer violation in `lib/`** — `claude-vision.ts` imports the `Viewport` type from `step-cache.ts`. A vision API client has no business depending on a cache module. The dependency direction is wrong.

2. **Server layer reaching into `lib/` directly** — `server/index.ts` imports `* as stepCache from '../lib/step-cache'` solely to call `clearAllSteps()`. The HTTP routing layer should only talk to server-layer modules, not lib internals.

3. **Duplicated game data source** — `GameEntry` and game-reading logic exist independently in both `server/games.ts` and `tests/games.ts`. There is no single source of truth for what a game entry is or how to read the game catalog.

The result is a codebase where it is difficult to reason about which module owns what, and changes to one module have unexpected ripple effects.

## Goals

- Remove all three layer violations listed above.
- Establish explicit, documented layer rules that are easy to verify at a glance.
- Make each module's responsibility clear without changing any runtime behavior.

## Non-Goals

- Splitting `discovery.ts` into smaller sub-modules.
- Changing the test orchestrator (`tests/game-spin.spec.ts`).
- Adding unit tests for individual lib modules.
- Changing any API contracts, Claude Vision prompts, or runtime behavior.
- Adding new features or improving performance.

---

## Proposed Architecture

### Layer Rules (after refactor)

| Layer | Module(s) | May import from |
|-------|-----------|-----------------|
| 0 — Shared types | `lib/types.ts` | nothing |
| 1 — Lib | `lib/*.ts` | `lib/types.ts`, peer lib modules where needed |
| 1 — Game data | `lib/games.ts` | `lib/types.ts` only |
| 2 — Server modules | `server/games.ts`, `server/runner.ts`, `server/url-builder.ts` | `lib/` |
| 3 — HTTP routes | `server/index.ts` | `server/` modules only — never `lib/` directly |
| 3 — Tests | `tests/` | `lib/` only |

**Key invariant:** `server/index.ts` is a routing file. It never imports from `lib/` directly.

### New Modules

**`lib/types.ts`**
Owns all shared cross-module types: `Viewport`, `DeviceType`, `CachedStep`, `GameSteps`. No internal imports. This is the neutral foundation every other lib module can depend on without creating a hierarchy violation.

**`lib/games.ts`**
Single source of truth for `GameEntry` (type) and `readGames()` (reads `data/games.json`, returns `GameEntry[]`, returns `[]` on error). No internal imports beyond `lib/types.ts` if needed.

### Changed Modules

**`lib/step-cache.ts`**
Imports `Viewport`, `DeviceType`, `CachedStep`, `GameSteps` from `lib/types.ts` instead of defining them. Re-exports them so existing importers are not broken.

**`lib/claude-vision.ts`**
Imports `Viewport` from `lib/types.ts`. The import from `step-cache` is removed entirely.

**`lib/discovery.ts`**
Imports `CachedStep` and `Viewport` from `lib/types.ts` directly. The type-only import of `step-cache` is removed.

**`server/games.ts`**
Imports `GameEntry` and `readGames` from `lib/games.ts`. Removes the duplicate type definition and duplicate implementation. Adds a `clearGameSteps(gameId)` function that delegates to `lib/step-cache.clearAllSteps()`.

**`server/index.ts`**
Removes `import * as stepCache from '../lib/step-cache'`. The `DELETE /api/games/:gameId/steps` route calls `games.clearGameSteps(gameId)` instead.

**`tests/games.ts`**
Imports `GameEntry` and `readGames` from `lib/games`. The exported `GAMES` constant becomes `readGames()`. Removes the duplicate type and inline file read.

---

## Implementation Plan

Each commit leaves the codebase in a working state. Run `npm run check` after each.

**Commit 1 — Create `lib/types.ts`**
Extract `Viewport`, `DeviceType`, `CachedStep`, and `GameSteps` from `step-cache.ts` into a new `lib/types.ts`. Update `step-cache.ts` to import them from `./types` and re-export them. All existing importers continue to work without change.

**Commit 2 — Fix `claude-vision.ts` layer violation**
Change the `Viewport` import in `claude-vision.ts` from `./step-cache` to `./types`. Remove the `step-cache` import from that file entirely.

**Commit 3 — Update `discovery.ts` to import types from `lib/types.ts`**
Replace the `import type * as stepCache` in `discovery.ts` with direct named imports of `CachedStep` and `Viewport` from `./types`. After this commit, `discovery.ts` no longer imports from `step-cache` at all.

**Commit 4 — Create `lib/games.ts`**
Create `lib/games.ts` exporting `GameEntry` type and `readGames()`. No internal imports. This becomes the canonical game catalog reader.

**Commit 5 — Update `tests/games.ts` to use `lib/games.ts`**
Replace the inline file read and duplicate type definition with imports from `../lib/games`. The exported `GAMES` constant becomes `readGames()`.

**Commit 6 — Update `server/games.ts` to use `lib/games.ts`**
Import `GameEntry` and `readGames` from `../lib/games`. Remove the duplicate implementation. `addGame()` and `getCachedGameIds()` remain in `server/games.ts` as server-layer concerns.

**Commit 7 — Add `clearGameSteps()` to `server/games.ts`**
Add `clearGameSteps(gameId: string)` that calls `stepCache.clearAllSteps(gameId)`. This consolidates all game-data operations into the server's games module.

**Commit 8 — Remove `lib/step-cache` import from `server/index.ts`**
Replace the direct `stepCache.clearAllSteps()` call with `games.clearGameSteps()`. After this commit, `server/index.ts` imports only from `server/` modules. This is the final structural fix.

---

## Testing Approach

No new tests are introduced in this refactor. All changes are purely structural — no logic, timing, prompts, or API calls change.

The gate for each commit is `npm run check` (Biome lint + TypeScript type-check). If `check` passes, the module graph is correct.

The existing Playwright integration test (`tests/game-spin.spec.ts`) exercises the full discovery and replay flow and would catch any accidental behavioral breakage.

---

## Out of Scope

- Removing the `step-cache` re-exports added in Commit 1 (small follow-up, keep separate)
- Splitting the discovery loop into sub-modules
- Changing `server/runner.ts` subprocess management
- Any changes to the test orchestrator
- Schema or API contract changes

# Plan: Establish Clear Module Boundaries

> Source PRD: docs/prd-module-boundaries.md

## Architectural decisions

- **Layer rule**: `lib/types.ts` has no internal imports — it is the neutral foundation
- **Layer rule**: `server/index.ts` imports only from `server/` modules — never from `lib/` directly
- **Layer rule**: `lib/` modules never import from `server/` or `tests/`
- **Key models**: `Viewport`, `DeviceType`, `CachedStep`, `GameSteps` live in `lib/types.ts`; `GameEntry` lives in `lib/games.ts`
- **Verification gate**: `npm run check` must pass after every phase

---

## Phase 1: Shared types foundation

**What this fixes**: `claude-vision.ts` imports `Viewport` from `step-cache.ts` — a layer violation. The fix is a neutral `lib/types.ts` that all lib modules can depend on.

### What to build

Create `lib/types.ts` as the home for all shared cross-module types. Update `step-cache.ts` to import from it and re-export those types so existing consumers are unaffected. Update `claude-vision.ts` and `discovery.ts` to source their types from `lib/types.ts` directly.

### Acceptance criteria

- [ ] `lib/types.ts` exists and exports `Viewport`, `DeviceType`, `CachedStep`, `GameSteps`
- [ ] `lib/types.ts` has zero internal imports
- [ ] `lib/step-cache.ts` imports all four types from `./types` and re-exports them
- [ ] `lib/claude-vision.ts` imports `Viewport` from `./types` — no import from `step-cache`
- [ ] `lib/discovery.ts` imports `CachedStep` and `Viewport` from `./types` — no type import from `step-cache`
- [ ] `npm run check` passes with no errors

---

## Phase 2: Unified game data source

**What this fixes**: `GameEntry` and `readGames()` are defined independently in both `server/games.ts` and `tests/games.ts`.

### What to build

Create `lib/games.ts` as the single source of truth for `GameEntry` and `readGames()`. Update `server/games.ts` and `tests/games.ts` to import from it, removing their duplicate definitions.

### Acceptance criteria

- [ ] `lib/games.ts` exists and exports `GameEntry` type and `readGames()` function
- [ ] `lib/games.ts` has no internal imports
- [ ] `server/games.ts` imports `GameEntry` and `readGames` from `lib/games.ts` — no duplicate definition
- [ ] `tests/games.ts` imports `GameEntry` and `readGames` from `lib/games.ts` — no duplicate definition
- [ ] `npm run check` passes with no errors

---

## Phase 3: Clean server routing layer

**What this fixes**: `server/index.ts` imports directly from `lib/step-cache` — the routing file reaches past the server layer into lib internals.

### What to build

Add `clearGameSteps()` to `server/games.ts` (delegates to `lib/step-cache`). Remove the direct `lib/step-cache` import from `server/index.ts` and replace with the new server-layer function.

### Acceptance criteria

- [ ] `server/games.ts` exports `clearGameSteps(gameId: string)`
- [ ] `server/index.ts` has no import from `lib/step-cache`
- [ ] `DELETE /api/games/:gameId/steps` calls `games.clearGameSteps(gameId)`
- [ ] `npm run check` passes with no errors

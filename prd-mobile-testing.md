## Problem Statement

The automation suite has no way to run discovery or replay against mobile viewports. Games often have separate mobile game IDs and require `channelid=mobile` in the URL. There is also no way to edit a game's IDs after it has been added, and the game registry uses the mutable `gameId` field as its primary key, making in-place edits of IDs unsafe.

## 

Introduce a stable GUID as the primary key for every game entry. Add a separate `mobileGameId` field alongside the existing `gameId` (desktop). Wire up a Playwright mobile-chrome project using iPhone 14 emulation so discovery and replay run against the correct mobile viewport and URL. Add an Edit Game modal to the dashboard so users can update game IDs at any time; changing any ID clears the full cache for that game. Migrate all existing game entries to carry a generated GUID on first load.

## User Stories

1. As a developer, I want each game entry to have a stable GUID primary key, so that I can safely update game IDs without breaking API routes or cache lookups.
2. As a developer, I want existing games in games.json to be automatically assigned GUIDs on first load, so that no manual data migration is required.
3. As a tester, I want to add a mobile game ID when registering a new game, so that mobile tests use the correct game ID.
4. As a tester, I want the mobile game ID to be completely separate from the desktop game ID, so that games with different IDs on each channel are handled correctly.
5. As a tester, I want Playwright to run discovery and replay against an iPhone 14 emulated viewport, so that mobile-specific UI flows are exercised.
6. As a tester, I want the mobile test to use `channelid=mobile` in the game URL, so that the casino platform serves the correct mobile game build.
7. As a tester, I want the mobile test to use the mobile game ID in the URL query params, so that the correct game variant is loaded.
8. As a tester, I want the desktop test to use `channelid=desktop` and the desktop game ID, unchanged from today, so that existing desktop tests are unaffected.
9. As a tester, I want a mobile-specific step cache entry keyed by GUID and device type, so that mobile steps do not overwrite desktop steps and vice versa.
10. As a tester, I want discovered mobile steps to be replayed on subsequent mobile runs without re-running discovery, so that mobile replay is as fast as desktop replay.
11. As a dashboard user, I want to open an Edit Game modal by clicking an edit icon on a game card, so that I can update game details after the game has been added.
12. As a dashboard user, I want to edit the game name, desktop game ID, and mobile game ID independently, so that partial updates are possible without re-entering all fields.
13. As a dashboard user, I want the cache to be fully cleared for a game when I save an edited game ID, so that stale steps from the old ID are never replayed.
14. As a dashboard user, I want the Add Game modal to include an optional Mobile Game ID field, so that both IDs can be set at creation time.
15. As a dashboard user, I want games with no mobile game ID to be stored and usable for desktop runs, so that games that are desktop-only still work.
16. As a dashboard user, I want the Edit Game modal to submit updates using the game's GUID, so that the route never breaks even if the game ID changes.
17. As a developer, I want the PATCH /api/games/:id endpoint to accept the GUID as the route param, so that the update route is stable.
18. As a developer, I want the step cache to be re-keyed by GUID, so that cache lookups remain correct even after a game ID is changed.
19. As a developer, I want clearing the cache for a game to remove all device type entries for that GUID, so that a full reset is always one operation.
20. As a developer, I want url-builder to use the desktop game ID when constructing the desktop URL and the mobile game ID when constructing the mobile URL, with no fallback between them, so that misconfigured games fail explicitly rather than silently loading the wrong variant.

## Implementation Decisions

### Data Model
- `GameEntry` gains a required `id: string` field (UUID v4) as the stable primary key.
- `gameId` is renamed in intent to "desktop game ID" — it is the game ID used when `channelid=desktop`.
- A new optional field `mobileGameId?: string` holds the mobile-channel game ID.
- `url` and `mobileUrl` continue to be derived/stored values built from `gameId` / `mobileGameId`.

### Migration
- On startup, `readGames()` checks each entry for the presence of `id`. Any entry missing `id` gets a generated UUID v4 assigned and the file is written back before returning.
- Migration is idempotent: repeated startups with a fully-migrated file are a no-op.

### Step Cache
- The top-level key in `game-steps.json` changes from `gameId` to the game's `id` (GUID).
- All `step-cache` functions (`getSteps`, `setSteps`, `clearSteps`, `clearAllSteps`) accept `id` as the first argument.
- A `clearAllSteps(id)` call removes the entire GUID entry, covering all device types and viewports.
- When a game's `gameId` or `mobileGameId` is updated via the edit endpoint, `clearAllSteps(id)` is called before persisting the new values.
- Existing cache entries keyed by old `gameId` strings will be orphaned; they will not be migrated (users can manually clear via the existing Clear Steps button).

### URL Builder
- `buildUrl()` accepts a `gameId` parameter explicitly for each channel.
- Desktop URL: `gameid=gameId`, `channelid=desktop`.
- Mobile URL: `gameid=mobileGameId`, `channelid=mobile`.
- If `mobileGameId` is absent and a mobile URL is requested, the builder throws rather than silently falling back to `gameId`.

### API
- New endpoint: `PATCH /api/games/:id` accepts `{ name?, gameId?, mobileGameId? }`, validates fields, calls `updateGame(id, updates)`.
- `updateGame()` in the games lib: looks up entry by GUID, applies updates, clears full cache if `gameId` or `mobileGameId` changed, persists.
- Existing `POST /api/games` generates a UUID v4 for the new entry before storing.

### Playwright Config
- A new project `mobile-chrome` is added using `devices['iPhone 14']` (390x844, deviceScaleFactor 3, Chrome user-agent).
- The existing `game-spin.spec.ts` already branches on project name containing "mobile" — no test logic changes needed.
- The mobile project runs the same spec file as the desktop project.

### Dashboard
- `AddGameModal`: add an optional "Mobile Game ID" text input alongside the existing "Game ID" (desktop) input.
- `EditGameModal` (new component): fields for name, desktop game ID, mobile game ID. Submits `PATCH /api/games/:id` using the game's GUID. Shown when user clicks edit icon on a game card.
- Game card / `GameSelector`: render a small edit icon button that opens `EditGameModal` with the current game's values pre-filled.
- `GameEntry` type in `src/dashboard/src/types.ts`: add `id`, `mobileGameId?` to mirror the server type.

## Testing Decisions

A good test exercises only the observable behavior of a module through its public interface — not internal state or implementation choices. Tests should verify inputs map to correct outputs and that side effects (like cache writes) are observable through the same public API.

**Modules to test:**

- **`step-cache`**: verify `clearAllSteps(id)` removes all device type entries; verify `getSteps` returns undefined after clear; verify `setSteps` then `getSteps` round-trip by GUID.
- **`url-builder`**: verify desktop URL contains correct `gameid` and `channelid=desktop`; verify mobile URL contains `mobileGameId` and `channelid=mobile`; verify builder throws when `mobileGameId` is absent and mobile is requested.
- **`games` lib**: verify `addGame()` assigns a GUID; verify `readGames()` migration assigns GUIDs to entries missing them and writes back; verify `updateGame()` clears cache when `gameId` changes; verify `updateGame()` clears cache when `mobileGameId` changes; verify `updateGame()` does not clear cache when only `name` changes.

**Prior art:** Look at any existing unit tests in `src/tests/` for patterns around file I/O mocking and module-level function testing.

## Out of Scope

- Running mobile tests on real physical devices or remote device farms.
- Support for browsers other than Chrome (e.g. Safari, Firefox) for mobile emulation.
- Automatic re-discovery after a game ID is edited.
- Per-device-type cache clearing (always clears all on ID change).
- Migration of existing orphaned cache entries keyed by old gameId strings.
- Multi-device or multiple mobile viewport sizes beyond iPhone 14.

## Further Notes

- The game `id` GUID should be generated using the Node.js built-in `crypto.randomUUID()` — no additional dependency needed.
- The mobile-chrome Playwright project should inherit the same `timeout` and `retries` settings as the desktop project.
- If a game has no `mobileGameId`, the mobile Playwright project should skip that game's test (same auto-skip logic already present for device/channel mismatches).

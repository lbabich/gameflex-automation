## Problem Statement

The automation suite currently builds game URLs directly and navigates to them via `page.goto()`. This worked for the previous launcher architecture, but the platform has moved to the GUL V2 launcher which requires going through a test harness: the user must navigate to the harness, fill in launch parameters (loader type, casino ID, operator account ID, regulations toggle), and click the appropriate launch button (Real/Demo) for the specific game. The old direct-URL approach and the operator wallet API are both obsolete under this flow.

Additionally, adding a new game currently only requires a game ID. Now that each game is launched via an integration provider (e.g. DGC = 51, Games Global = 9, Play N Go = 114), the game's provider ID must be captured at registration time so the harness URL can be constructed correctly.

## Solution

Introduce a **pre-launch module** that handles the harness navigation flow before the existing discovery/replay logic runs. Add a **launch config file** (`src/config/launch-config.json`) for environment-level harness settings. Extend `GameEntry` with a required `gameProviderID` field. Retire the direct URL builder and operator wallet paths in favour of the unified harness-based launch.

The flow becomes:
1. Build the harness URL from config + game entry (provider ID, game ID, channel)
2. Navigate to the harness URL (basic auth via `httpCredentials` in Playwright config)
3. Fill the launch form (loader, operator account ID, regulations)
4. Click the Real or Demo button for the filtered game row
5. Wait for `gel.ready` — then proceed with existing discovery or replay logic unchanged

## User Stories

1. As an automation engineer, I want all game launches (demo and real) to go through the GUL test harness, so that the automation matches the actual operator launch path.
2. As an automation engineer, I want the harness URL to be built automatically from config + game entry, so that I never need to hand-craft launch URLs.
3. As an automation engineer, I want environment-level harness settings (casino ID, operator account ID, loader type, regulations) stored in a config file, so that switching environments requires changing one file rather than touching test code.
4. As an automation engineer, I want the pre-launch module to select the correct launch button (Real or Demo) based on the game's configured play mode, so that the right money mode is always used.
5. As an automation engineer, I want the pre-launch to set the channel (desktop or mobile) via the harness URL query param, so that no extra form interaction is needed for mobile tests.
6. As an automation engineer, I want the existing `gel.ready` game-ready signal to remain the trigger for discovery/replay, so that no changes are needed to the discovery or replay modules.
7. As an automation engineer, I want Claude Vision coordinate detection to work unchanged after pre-launch, so that the GUL V2 chrome (top bar, bottom bar) does not require screenshot cropping or prompt changes.
8. As a user of the web UI, I want to be required to supply a game provider ID when adding a new game, so that the harness URL can be built correctly for that game.
9. As a user of the web UI, I want the game provider ID to be stored alongside the game entry, so that it is available at test time without manual lookup.
10. As an automation engineer, I want existing game entries without a provider ID to be migrated gracefully, so that the app does not crash on startup with legacy data.
11. As an automation engineer, I want the pre-launch module to wait for the harness form to be ready before interacting with it, so that flaky timing-related failures are avoided.
12. As an automation engineer, I want basic auth credentials for the harness to come from the existing `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` environment variables already wired into the Playwright `httpCredentials` config, so that no additional credential management is needed.
13. As an automation engineer, I want the old url-builder and operator-wallet modules retired, so that there is only one launch path to maintain.
14. As a user of the web UI, I want to see the game provider ID displayed alongside a game's other fields, so that I can verify it is correct.
15. As a user of the web UI, I want to be able to update a game's provider ID via the existing PATCH endpoint, so that I can correct mistakes without deleting and re-adding the game.
16. As an automation engineer, I want the `POST /api/games` endpoint to return a 400 error if `gameProviderID` is missing, so that incomplete game entries are rejected at entry time.
17. As an automation engineer, I want the pre-launch to use the `search` query parameter to pre-filter the games list to the target game ID, so that the correct game row is always found without scrolling or ambiguity.
18. As an automation engineer, I want the pre-launch to select Loader = host-gul-v2 from the harness form, so that the correct launcher version is always used.
19. As an automation engineer, I want regulations to be disabled in the harness form during test runs, so that regulation dialogs do not interrupt discovery or replay.
20. As an automation engineer, I want the pre-launch module to be a clearly named, standalone module in `src/lib/`, so that it can be read and reasoned about independently from discovery and replay.

## Implementation Decisions

### Modules to build / modify

**`src/config/launch-config.json` (new)**
A committed JSON config file (not `.env`) containing environment-level harness settings:
- `harnessBaseUrl` — base URL of the GUL test harness
- `operatorcode`, `brandid`, `platformkey`, `launchtype` — harness URL query params
- `loaderType` — the loader option value to select (e.g. `host-gul-v2`)
- `casinoId` — Casino ID field value
- `operatorAccountId` — Operator Account ID field value
- `regulationsEnabled` — boolean, set to `false` for test runs

**`src/lib/pre-launch.ts` (new)**
A module that encapsulates the full harness interaction sequence. Its public interface accepts a Playwright `Page`, a `GameEntry`, a `DeviceType`, and a `PlayMode`, and performs:
1. Builds the harness URL from `launch-config.json` + game entry (provider ID, game ID, channelid)
2. Calls `page.goto()` with the harness URL
3. Waits for the launch form to be ready
4. Selects the configured loader from the Loader dropdown
5. Fills the Operator Account ID field
6. Unchecks Regulations Enabled if `regulationsEnabled=false` in config
7. Clicks the Real or Demo button in the game row matching the game ID

**`src/lib/url-builder.ts` (retired)**
The existing `buildSingleUrl()` function is no longer needed. The pre-launch module builds the harness URL directly. This module should be removed.

**`src/lib/operator-wallet.ts` (retired)**
The operator wallet API call is no longer the mechanism for real-money launch; the harness handles session token generation internally. This module should be removed.

**`src/lib/games.ts` (modified)**
`GameEntry` gains a new required field: `gameProviderID: string`. The auto-migration in `readGames()` handles existing entries without this field by defaulting to an empty string, so the app does not crash on legacy data.

**`src/server/routes/games.ts` (modified)**
`POST /api/games` now requires `gameProviderID` in the request body; returns 400 if absent.
`PATCH /api/games/:id` accepts `gameProviderID` as an updatable field.

**`src/tests/game-spin.spec.ts` (modified)**
The URL selection and `page.goto()` block is replaced with a call to the pre-launch module. Everything after that (gel.ready wait, discovery/replay) is unchanged.

### Schema changes

`GameEntry` before:
`{ id, desktopGameID, mobileGameID?, name, desktopEnabled, desktopPlaymode, mobileEnabled, mobilePlaymode }`

`GameEntry` after:
`{ id, desktopGameID, mobileGameID?, name, gameProviderID, desktopEnabled, desktopPlaymode, mobileEnabled, mobilePlaymode }`

Migration: `readGames()` defaults `gameProviderID` to `""` for existing entries. Tests for games with an empty provider ID fail at the pre-launch step with a clear error rather than crashing at startup.

### Harness URL structure

```
{harnessBaseUrl}
  ?operatorcode={operatorcode}
  &brandid={brandid}
  &platformkey={platformkey}
  &integrationproviderid={game.gameProviderID}
  &channelid={desktop|mobile}
  &search={game.desktopGameID or game.mobileGameID}
  &launchtype={launchtype}
```

All fields except `integrationproviderid`, `channelid`, and `search` come from `launch-config.json`.

### Play mode mapping

| GameEntry playmode | Harness button clicked |
|--------------------|----------------------|
| `demo`             | Demo                 |
| `real`             | Real                 |

Fun mode is out of scope.

### Basic auth

Handled by the existing `httpCredentials` in `playwright.config.ts` (reads `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` from `.env`). No changes needed.

### Coordinate system

`page.mouse.click()` at full-viewport coordinates works through the nested iframe. The GUL V2 chrome (top header ~60px, bottom bar ~50px) does not affect Claude Vision's ability to identify and return spin button coordinates. No screenshot cropping or prompt changes required.

### Game-ready signal

`gel.ready` console event remains the signal. No changes to `gel-events.ts`, `discovery.ts`, or `replay.ts`.

## Testing Decisions

Good tests verify observable external behaviour — that the right URL was navigated to, the right form values were set, and the right button was clicked — without asserting on internal implementation details such as private function calls.

**Modules tested:**
- `pre-launch.ts` is tested implicitly through the full `game-spin.spec.ts` integration test runs (no dedicated unit test)
- `games.ts` migration logic (new `gameProviderID` default) is covered by the existing vitest unit test suite, since `readGames()` already has migration tests as prior art
- `POST /api/games` validation for the new `gameProviderID` field is covered by route-level tests following the pattern of existing route tests

## Out of Scope

- **Fun mode** — the `fun` launch button exists in the harness but is not mapped to a `PlayMode` value
- **Mobile pre-launch form interaction** — channel is set via the `channelid` URL query param; no additional form changes are needed
- **Screenshot cropping / masking of GUL V2 chrome** — Claude Vision handles this visually without modification
- **Multi-environment harness config switching** — a single `launch-config.json` is used; environment switching is manual
- **Regulations-enabled test scenarios** — automation always runs with regulations disabled

## Further Notes

- The GUL V2 launcher wraps the game in a nested iframe (`gamedistribute.com` domain). Playwright's `page.mouse.click()` dispatches clicks correctly at viewport coordinates through iframe boundaries, so discovery and replay work without modification.
- The `search` query param on the harness URL pre-filters the games list to the target game row, meaning the pre-launch module can reliably find and click the correct Real/Demo button without scrolling.
- Real-money spins against the test account hit a daily protection limit (GUL Connector error -1). Demo mode is recommended for routine CI runs.
- Basic auth credentials must be present in `.env` as `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` for the harness login wall to be passed.

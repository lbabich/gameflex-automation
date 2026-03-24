## Problem Statement

The current automation suite supports exactly one test flow: launch the game, discover the spin button, verify `gel.spin.start` and `gel.spin.end`. There is no mechanism to test other game functionality (e.g. the close/home button), no way to record and cache the navigation steps required for alternative flows, and no way for a user to select which flows they want to validate for a given game.

As the team needs to certify more game behaviours beyond a single spin, the hard-coded single-flow architecture becomes a bottleneck.

---

## Solution

Introduce a **scenarios** system. A **scenario** is a combination of **steps** selected by the user (e.g. `[spin, close]`). Each step is a named test objective — a UI action (found via Claude Vision) followed by one or more GEL event assertions. Discovery runs the full selected combination as **one continuous session** and caches all navigation steps under a deterministic combination key. Subsequent runs look up that key; if found, they replay; if not, they discover.

The cache key is the **sorted combination of selected step IDs joined with `+`** (e.g. `"close+spin"`, `"close"`, `"spin"`). Changing the selected combination produces a different key, triggering fresh discovery for that combination. Cached entries for other combinations remain available.

The dashboard gains a per-game step selector (multi-select dropdown in `GameActionBar`) and the results panel shows one row per game with step outcomes visible in the step breakdown.

**Initial steps shipped:**

| ID | Name | Objectives | Final GEL event |
|----|------|-----------|----------------|
| `spin` | Spin Test | Navigate to spin button → click | `gel.spin.end` |
| `close` | Close Game | Navigate to spin → click → wait idle → find menu/home → click | `gel.close` |

**Multi-step scenarios** share one Playwright browser session per game (the game launches once). Steps execute in a defined order (`order` field) — non-destructive before destructive. Discovery for a combination runs one continuous session: spin completes, then without reloading, the close navigation phase begins.

---

## User Stories

1. As a QA engineer, I want to choose which steps run for each game so that I can tailor what is validated per game.
2. As a QA engineer, I want to see a multi-select step dropdown in the game action bar so that step selection is visible at a glance.
3. As a QA engineer, I want my step selection saved automatically so that it persists between sessions without manual reconfiguration.
4. As a QA engineer, I want the default step for all new games to be the spin test so that existing workflow is unchanged.
5. As a QA engineer, I want to be able to select "Close Game" alongside the spin test so that both flows are validated in one run.
6. As a QA engineer, I want a single game launch when a combination of steps is selected so that I am not waiting for repeated browser launches.
7. As a QA engineer, I want different step combinations cached independently so that switching from [spin+close] to [close] triggers fresh discovery for the new combination without discarding the old one.
8. As a QA engineer, I want discovery for the close step to receive accumulated context about what has already been found so that Claude Vision knows the spin objective is complete and targets the menu/home button next.
9. As a QA engineer, I want the results panel to show one row per game with step outcomes in the step breakdown so that I can see which step failed within a run.
10. As a QA engineer, I want each result row to include a GIF covering the full session so that I can review what happened across all steps in order.
11. As a QA engineer, I want the close step to pass only when `gel.close` fires in the browser console so that the close event is genuinely triggered.
12. As a QA engineer, I want discovery to automatically progress through pre-spin overlays (splash screens, dialogs) using the existing detectNextClick logic so that new steps do not require separate overlay handling.
13. As a QA engineer, I want the cached badge on each device card to reflect whether the current step combination has a cached entry so that I know at a glance if discovery is needed.
14. As a QA engineer, I want the per-device Reset button to clear all cached combination entries for that device so that a full re-discovery is easy to trigger.
15. As a QA engineer, I want to see which steps are enabled for a game without opening a settings panel so that the game list is informative at a glance.
16. As a QA engineer, I want the run to execute steps in the defined order (spin before close) within a combined discovery/replay session so that close always starts from a post-spin idle state.
17. As a QA engineer, I want step discovery to pass an accumulating context string to each Claude Vision call so that the model knows which objectives are complete and what to look for next.
18. As a QA engineer, I want partial discovery failures to be stored with a `partial: true` flag so that I can tell which navigation step failed and whether it is safe to replay partial steps.
19. As a QA engineer, I want `GET /api/scenarios` to return the list of available steps so that the dashboard can render the selector without hardcoding names.
20. As a QA engineer, I want `PUT /api/games/:id/scenarios` to persist step selection so that the server is the source of truth for per-game configuration.
21. As a QA engineer, I want the step selection API to reject unknown step IDs so that typos or stale data do not silently create broken configurations.
22. As a QA engineer, I want annotations in the results row (e.g. load-time-ms, had-load-progress) carried through the same way as today so that timing data is not lost.
23. As a QA engineer, I want false-positive clicks in the close navigation phase (where a click does not trigger gel.close) to be blacklisted and retried, the same way spin false positives are handled today.
24. As a QA engineer, I want the GIF to include screenshots from all steps in the session in chronological order so that the full flow is reviewable as one animation.

---

## Implementation Decisions

### Step Registry (`src/lib/scenarios.ts`)

A new module exports a static `STEPS` registry:

```
StepID = 'spin' | 'close'

StepDefinition = {
  id: StepID
  name: string
  description: string
  order: number                    // execution order within a combined run (spin=1, close=2)
  isDestructive: boolean           // true = run last; close step closes the game
  successEvents: GelEvent[]        // all GEL events that must fire for this step
}

combinationKey(steps: StepID[]): string
  // = steps.sort().join('+')  e.g. ['close','spin'] -> 'close+spin'
```

Steps are hardcoded for the initial release. Adding a new step requires a code change.

---

### Step Cache Schema — Combination Key

Old cache structure is **discarded** (no migration). The new structure:

```
{ [gameID]: { [deviceType]: { [combinationKey]: { [viewportKey]: GameSteps } } } }

Example:
{
  "abc123": {
    "desktop": {
      "spin":        { "1280x720": { "discoveredAt": "...", "steps": [...] } },
      "close+spin":  { "1280x720": { "discoveredAt": "...", "steps": [...] } }
    }
  }
}
```

The combination key is derived from `selectedSteps.sort().join('+')`. Two different selections always produce different keys and never share a cache entry.

Step-cache functions take a `combinationKey` parameter:

```
getSteps(gameID, deviceType, combinationKey, viewport)
setSteps(gameID, deviceType, combinationKey, viewport, steps)
clearAllSteps(gameID)
clearChannelSteps(gameID, deviceType)          // clears ALL combinations for that device
getCachedCombinations(gameID, deviceType)      // returns string[] of cached combination keys
```

---

### Step Selection Storage (`src/data/scenarios.json`, `src/lib/scenario-selection.ts`)

A JSON file maps game GUIDs to currently selected step IDs:

```json
{
  "[gameID]": ["spin", "close"]
}
```

Managed by `src/lib/scenario-selection.ts`:

```
getSelectedSteps(gameID): StepID[]     // returns ['spin'] if no entry exists
setSelectedSteps(gameID, steps: StepID[])
removeGame(gameID)                      // called when a game is deleted
```

New games default to `["spin"]`. Entries are created lazily on first update. When a game is deleted from `games.json`, its entry here is also removed.

---

### Claude Vision — New `detectNextGoal` Function

A new function handles objective-driven navigation (distinct from the spin-centric `detectNextClick`):

```
detectNextGoal(
  screenshotPath: string,
  viewport: Viewport,
  goal: string,               // current objective, e.g. "Find the menu or home button to close the game"
  foundSoFar: string,         // accumulated context, e.g. "Spin button found and clicked. Spin complete."
  failedButtons?: FailedButton[]
): Promise<NextResult>
```

The prompt has no spin-specific framing. It describes the current objective clearly and passes accumulated context about already-completed steps.

`detectNextClick` is **unchanged** — it continues to handle the pre-spin phase (dismissing overlays, splash screens, dialogs) in all scenarios.

---

### Discovery — Combination-Aware (`src/lib/discovery.ts`)

`discoverSteps` gains a `stepCombination: StepDefinition[]` parameter (sorted by `order`):

**Phase 1 — Pre-spin navigation (all combinations):**
- Same as today: `detectSpinButton` / `detectNextClick` loop until spin button found and `gel.spin.start` fires

**Phase 2 — Spin complete (all combinations):**
- Wait for `gel.spin.end`

**Phase 3 — Additional objectives (multi-step combinations only):**
- For each remaining step (e.g. close), run a `detectNextGoal` loop:
  - Goal string = step's objective description
  - `foundSoFar` string builds up as navigation steps are recorded
  - False-positive handling: blacklist clicks that don't trigger the expected GEL event; retry up to `DISCOVERY_MAX_ATTEMPTS = 20` attempts
  - On success (expected GEL event fires), record navigation step and move to next step
- Wait `POST_SPIN_BUFFER_MS` before starting each additional objective loop

**Return value:** all accumulated navigation steps from game-ready through final GEL event, stored under the combination key.

---

### GEL Events (`src/lib/gel-events.ts`)

Add:
```ts
GEL_EVENT.CLOSE = 'gel.close'
```

---

### Playwright Test File (`src/tests/game-spin.spec.ts`)

**Structure change:** one `test(game.name, ...)` per game per device (not one per step). Steps execute as `test.step` blocks inside the single test.

**Flow:**
1. Load `scenarios.json` alongside `games.json` via `scenario-selection.ts`
2. For each game, determine `selectedSteps`, sort by `StepDefinition.order`
3. Compute `combinationKey = selectedSteps.sort().join('+')`
4. Generate `test(game.name, async ({ page }) => { ... })`
5. Inside the test:
   - Launch game via harness (`test.step`)
   - Check cache for that combination key; discover if missing, replay if cached
   - **Before discovery/replay**, register event listeners for ALL `successEvents` in the combination (pre-register as flags)
   - Run each step's `test.step` block in order — each asserts its `successEvents` fired
   - Each step's terminal screenshots use a step-indexed prefix (`01-spin-final-*.png`, `02-close-final-*.png`)
   - **Fresh listeners** per step block (no shared state between steps)
   - GIF generation covers all screenshots in the session

**Screenshot naming convention:**
```
01-spin-discovery-{N}.png
01-spin-spin-start.png
01-spin-final-1.png
02-close-discovery-{N}.png
02-close-final-1.png
```

GIF generator sort order: numeric step prefix first, then existing pattern order within that prefix.

---

### Server Routes — New Scenario Endpoints (`src/server/routes/scenarios.ts`)

```
GET  /api/scenarios              -> StepDefinition[]  (static registry)
GET  /api/games/:id/scenarios    -> { selectedSteps: StepID[] }
PUT  /api/games/:id/scenarios    -> body: { selectedSteps: StepID[] }
                                    -> 204 No Content
                                    -> 400 if unknown step ID
                                    -> 404 if game not found
```

`GET /api/games` gains `selectedSteps: StepID[]` and `cachedCombinations: { desktop: string[], mobile: string[] }` per game entry.

---

### Games Service / Cache API changes

- `getCachedDeviceMap()` is replaced by `getCachedCombinations(gameID, deviceType): string[]`
- `clearAllSteps(gameID)` clears all devices and all combinations
- `clearChannelSteps(gameID, deviceType)` clears all combinations for that device
- Device badge shows: is the current `selectedSteps` combination cached?

---

### Dashboard Changes

**GameActionBar:**
- Multi-select step dropdown added next to the demo/real toggle
- Fetches available steps from `GET /api/scenarios`
- Current selection from `GET /api/games` (in `selectedSteps`)
- Changes persisted via `PUT /api/games/:id/scenarios`

**GameDeviceSettings:**
- Cached badge: shows cached if current combination has a cache entry; shows a "partial" indicator if other combinations are cached but not the current one

**ResultsPanel:**
- One row per game per device (test title = game name)
- Step outcomes visible in the step breakdown within each row
- Single GIF per game per device covers the full session

---

## Testing Decisions

**What makes a good test:** Tests should exercise public module behaviour through exported APIs, not internal implementation details. Set up inputs, call the function, assert on return values or side effects. Do not assert on specific Claude Vision prompt strings.

**Modules to test:**

- `src/lib/scenarios.ts` — Verify registry definitions for `spin` and `close`; verify `combinationKey()` produces deterministic sorted output.
- `src/lib/step-cache.ts` — Verify combination-keyed read/write/clear; verify `getCachedCombinations` returns only keys that have entries.
- `src/lib/scenario-selection.ts` — Verify read/write of `scenarios.json`; unknown step IDs rejected; default `['spin']` returned for missing entry.
- `src/server/routes/scenarios.ts` — Route-level tests: GET, PUT happy path and error cases (unknown step ID, game not found).

**Prior art:** Existing unit tests (`npm run test:unit` via Vitest) for structural reference.

---

## Out of Scope

- Adding new step types beyond `spin` and `close` in this implementation.
- Config-file-driven step definition (no-code extensibility).
- Fine-grained per-combination reset button (device-level reset clears all combinations).
- Visual confirmation of game closure (pass condition is `gel.close` console event only).
- Parallel step execution within a session.
- Cross-game step sequencing.

---

## Further Notes

- **`close` is destructive** (`isDestructive: true`). After `gel.close` fires, the game is closed and no further steps can run. Execution order must put close last.
- **`gel.close` is confirmed** as the real event name emitted by the game harness when the home/close button is actioned.
- **No cache migration.** The existing `game-steps.json` is discarded when this feature ships. Games will require re-discovery on first run after the update.
- **Discovery timeout per additional objective phase:** `DISCOVERY_MAX_ATTEMPTS = 20` — same constant reused. The post-spin idle wait (`POST_SPIN_BUFFER_MS`) is applied before each additional objective's detection loop.
- **Combined discovery example** for `[spin, close]`:
  1. Pre-spin navigation (overlays dismissed via `detectNextClick`)
  2. Spin button found via `detectSpinButton`, clicked, `gel.spin.start` fires
  3. Wait for `gel.spin.end`
  4. Wait `POST_SPIN_BUFFER_MS` for game to settle at idle
  5. Close objective: `detectNextGoal("Find the menu or home button", "Spin complete.")` loop
  6. Menu button clicked, home button clicked, `gel.close` fires
  7. All navigation steps cached under `"close+spin"`

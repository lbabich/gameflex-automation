# refactor: run history cap, failure detail, and sidebar cleanup

## Problem Statement

Three improvements are needed:

1. Run history is capped at 100 on disk and 50 via the API — this is more than useful. 10 is sufficient.
2. When a test fails, `TestResult` stores the error message and a flat `steps[]` array, but the specific step that failed must be inferred by scanning for the first entry with an `error` field. Additionally, no screenshot is captured at failure time, so there is nothing visual to link to.
3. The game selector sidebar shows `pass`, `fail`, and `err` badges next to game names. These add visual noise; only the running indicator is useful.

## Solution

1. Reduce the run history cap to 10 at every layer: in-memory trim, disk save, and API response.
2. Add a `failedStep` field to `TestResult` that names the first failing step directly. Enable `screenshot: 'only-on-failure'` in Playwright config, copy screenshots to a stable served directory at finalization, and expose `screenshotUrls` on `TestResult` so the UI can link to them.
3. Remove the `pass`, `fail`, `err` badge JSX from `GameSelector`. Keep only the running spinner. Remove the now-unused `lastStatus` field from the `gameStatuses` computation in `App.tsx`.

## Commits

**Commit 1 — Trim run history to 10**
- In `finalize.ts`, change the in-memory cap from 100 to 10 in `trimMemory()`, and change the disk-save `.slice(0, 100)` to `.slice(0, 10)` in `saveRuns()`.
- In `runner.service.ts`, change the `getRecentRuns` default limit from 50 to 10.
- In `routes/runs.ts`, remove the hardcoded `50` argument from `getRecentRuns(50)` so it uses the default.

**Commit 2 — Surface the failing step on TestResult**
- Add `failedStep?: string` to `TestResult` in both `src/server/services/runner/types.ts` and `src/dashboard/src/types.ts`.
- In `toTestResult()` in `report-parser.ts`, find the first step with a non-null `error` field and assign its `title` to `failedStep`. If no step has an error, leave it undefined.
- In `ResultsPanel.tsx`, render `result.failedStep` below `result.error` in the collapsed test row (visible without expanding), so at a glance you can see which step caused the failure.
- Add a test case in `report-parser.test.ts` that verifies `failedStep` is populated when a step carries an error.

**Commit 3 — Enable and surface failure screenshots**
- Add `screenshot: 'only-on-failure'` to the `use` block in `playwright.config.ts`.
- In `report-parser.ts`, add `attachments?: Array<{ name?: string; path?: string; contentType?: string }>` to the TestNode result type. In `toTestResult()`, extract `path` values from attachments where `contentType` is `image/png` and store them as `screenshotPaths?: string[]` on `TestResult`. This field is internal and must not be persisted.
- Add `screenshotPaths?: string[]` to the server-side `TestResult` type only (it is consumed and cleared before saving).
- Add `screenshotUrls?: string[]` to both `TestResult` types (server and dashboard) — this field is persisted, analogous to `gifUrl`.
- In `finalize.ts`, add an `attachScreenshotUrls(runID, results)` Effect that iterates over each result's `screenshotPaths`, copies each file to `src/server/screenshots/<runID>/failure/<filename>` using the `FileService`, sets `result.screenshotUrls` to the corresponding `/api/screenshots/<runID>/failure/<filename>` URLs, then clears `result.screenshotPaths` (sets to `undefined`). Call this in `finalizeRun()` after `attachGifUrls()`.
- In `ResultsPanel.tsx`, render each `screenshotUrls` entry as an `<a href="..." target="_blank" rel="noreferrer">` link in the expanded detail row.

**Commit 4 — Remove pass/fail/err badges from GameSelector**
- Delete the three conditional badge JSX blocks for `pass`, `fail`, and `err` from `GameSelector.tsx`. Keep the running spinner block unchanged.
- Remove `lastStatus` from the `GameStatus` type in `GameSelector.tsx` and from the `gameStatuses` computation in `App.tsx` — it is no longer consumed anywhere.

## Decision Document

- **10 as the uniform cap**: Applied at in-memory, disk, and API layers simultaneously so they can never drift out of sync. Not a configuration constant — just a hardcoded change.
- **`failedStep` as a string**: Stores the step title, not an index. The title is what is meaningful to display. If the test fails at the test level with no steps, or no step has an error, the field is absent.
- **Screenshot storage in `src/server/screenshots/<runID>/failure/`**: Playwright writes screenshots to `test-results/`, which is cleared before each new Playwright run. Copying them to the screenshots directory makes them stable across subsequent runs. The existing `/api/screenshots/:gameID/:deviceType/:filename` route already handles these paths without modification — `<runID>` and `failure` satisfy the existing `safe()` regex (`[\w.-]+`).
- **`screenshotPaths` is internal and never persisted**: It is populated by `parseJsonReport`, consumed by `attachScreenshotUrls`, then set to `undefined`. Because it is `undefined` by the time `saveRuns` serializes the run, it does not appear in `runs.json`. No stripping logic needs to be added to `saveRuns`.
- **`lastStatus` removal is safe**: After removing the badges, `lastStatus` on `gameStatuses` is not read anywhere in the app. `desktopLastStatus` and `mobileLastStatus` are still used by `GameDeviceSettings` and are unaffected.
- **Dashboard and server types kept in sync**: Any field that flows over the `GET /api/runs` or `GET /api/runs/:id` wire must appear in both `src/server/services/runner/types.ts` and `src/dashboard/src/types.ts`.

## Testing Decisions

A good test in this codebase:
- Tests the module's external contract (what goes in, what comes out), not its internal steps.
- Uses the `makeReport()` fixture helper pattern already established in `report-parser.test.ts`.

Modules with tests:
- `report-parser.ts` — existing coverage in `report-parser.test.ts`. Add: (a) a test asserting `failedStep` is set to the failing step's title when a step has an error; (b) a test asserting `screenshotPaths` is populated from `attachments` with `contentType: 'image/png'`. Both follow the existing `makeReport()` fixture pattern.
- `runner.service.ts` — existing coverage in `runner.service.test.ts`. The `getRecentRuns` tests already pass an explicit limit; no new test is needed for the default change since the behaviour is straightforward.

No new tests needed for:
- `GameSelector.tsx` / `App.tsx` — pure UI changes with no logic unit-testable in isolation.
- `finalize.ts` `attachScreenshotUrls` — would require mocking the file system; the behaviour is integration-level and verified by running the full suite.

## Out of Scope

- Cleaning up or pruning accumulated `src/server/screenshots/<runID>/failure/` directories over time.
- Removing the `test-results/` Playwright output directory automatically.
- Any changes to `GameDeviceSettings` badges (the desktop/mobile device cards with cached/pass/fail/err per-device badges remain unchanged).
- Changing the `RecentRunsList` component or how many runs are displayed in the runs list UI.
- Changing how the GIF replay is displayed in `ResultsPanel`.

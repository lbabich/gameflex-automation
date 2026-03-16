# Architecture

## Components

| Component | Role |
|-----------|------|
| Claude Vision | Sends screenshots to the Claude API and parses JSON responses |
| Discovery | Orchestrates the discovery loop: finds and clicks the spin button, recording each navigation step |
| GIF Generator | Encodes PNG screenshots into an animated GIF, then deletes the source PNGs |
| Replay | Replays cached steps by waiting, injecting a click marker, screenshotting, and clicking |
| Screenshot | Takes and saves Playwright screenshots |
| Step Cache | Reads and writes the step cache; no in-memory state |
| HTTP Server | Express HTTP API used by the web UI to manage games, runs, and cached steps |
| Test Runner | Playwright test: runs discovery or replay for each game |

## Data Flow

### Discovery flow

1. The test navigates to the game URL.
2. The step cache is checked — on a miss, discovery runs.
3. Discovery waits for the game to load, then loops until the spin button is found:
   - A screenshot is taken.
   - Claude Vision checks if the spin button is visible and unobstructed.
   - If found: the spin button is clicked and the spin is confirmed; the step is recorded and discovery ends.
   - If a false positive (navigation): the step is recorded and the loop continues.
   - If not found: Claude Vision identifies the next navigation target and clicks it.
4. The discovered steps are written to the step cache.
5. The test waits for spin-start and spin-end events.
6. A final screenshot is taken.
7. All screenshots are encoded into an animated GIF; source PNGs are deleted.

### Replay flow

1. The test navigates to the game URL.
2. The step cache is checked — on a hit, replay runs.
3. Replay iterates each cached step: waits the recorded delay, injects a click-marker overlay, takes a screenshot, then clicks.
4. The test waits for spin-start and spin-end events.
5. All screenshots are encoded into an animated GIF; source PNGs are deleted.

## Key Invariants

These constraints must not be broken. They are not enforced by the type system.

1. **Cache is file-only** — The step cache reads and writes on every call. There is deliberately no in-memory state. Never add module-level caching to step-cache.

2. **PNGs deleted after GIF** — The GIF generator deletes all source PNGs after encoding. Do not rely on PNGs being present after GIF generation completes.

3. **Headed mode required** — Games that use WebGL fail in headless mode. Always run these tests with `PW_HEADLESS=0`.

4. **Single test instance** — All test runs write to the same screenshots directory. Running two Playwright processes simultaneously causes screenshots to overwrite each other.

# Architecture

## Domain modules

The codebase is organised by domain rather than technical layer. Each domain folder owns all the logic for one concern and exposes a `.module.ts` barrel as its public interface.

### `game-catalog`
Game CRUD: adding, updating, deleting, and listing games. Owns the disk persistence format and the Effect service that callers depend on. The step cache is cleared automatically whenever a game's ID fields change.

### `run`
Run lifecycle: starting, cancelling, and finalising Playwright runs. Spawns the game-session-automation child process, streams its output, parses the JSON result, attaches screenshot and GIF URLs, and persists the finished record to disk.

### `game-session-automation`
The Playwright child process. Launched by the run domain as a separate process. Runs discovery or replay for each game, accumulates GEL events, takes screenshots, and writes a JSON result to stdout on exit. Contains its own sub-domains:
- **steps** — the ordered steps executed per game (load, spin, audio, close)
- **discovery** — the Claude Vision loop that finds the spin button

### `router`
HTTP routing only. One router file per API surface (`game-catalog`, `runs`, `screenshots`). Imported by the Express entry point; not imported by any domain module.

### Shared modules at the core root
- **step cache** — in-memory and disk step cache; shared between game-catalog and game-session-automation
- **file service** — Effect wrapper for filesystem reads and writes
- **errors** — tagged domain error classes used across domains
- **types** — constants and types shared across domains
- **runtime** — wires all service layers into the ManagedRuntime used by route handlers

---

## Data Flow

### Discovery flow

1. The child process navigates to the game URL.
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

1. The child process navigates to the game URL.
2. The step cache is checked — on a hit, replay runs.
3. Replay iterates each cached step: waits the recorded delay, injects a click-marker overlay, takes a screenshot, then clicks.
4. The test waits for spin-start and spin-end events.
5. All screenshots are encoded into an animated GIF; source PNGs are deleted.

### Run lifecycle

1. An HTTP request starts a run, passing game IDs and device types.
2. The run domain creates a record, forks a background fiber, and returns immediately.
3. The fiber spawns the game-session-automation entry point as a child process.
4. The child process streams stderr to the server console and writes a JSON result to stdout on exit.
5. The run domain parses the result, attaches URLs, and persists the final record to disk.

---

## Key Invariants

These constraints must not be broken. They are not enforced by the type system.

1. **Cache is file-only** — The step cache reads and writes on every call. There is deliberately no in-memory state. Never add module-level caching to the step cache.

2. **PNGs deleted after GIF** — The GIF generator deletes all source PNGs after encoding. Do not rely on PNGs being present after GIF generation completes.

3. **Headed mode required** — Games that use WebGL fail in headless mode. Always run with headed mode enabled.

4. **Single test instance** — All test runs write to the same screenshots directory. Running two Playwright processes simultaneously causes screenshots to overwrite each other.

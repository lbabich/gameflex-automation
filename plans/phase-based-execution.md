# Plan: Phase-Based Execution with Generic Discovery and Event Accumulator

> Source PRD: refactor spin.ts / spin-runner.ts into modular, step-driven execution

## Architectural decisions

- **Entry script**: `src/server/scripts/test-runner.ts` (replaces `spin.ts`)
- **CLI args**: `--runID`, `--gameIDs`, `--deviceTypes`, `--playmode`, `--steps`
- **Output shape**: `{ results: Partial<Record<DeviceType, InternalTestResult>>, errors: string[] }` — unchanged, stdout JSON consumed by server output parser
- **Step modules**: live at `src/server/lib/steps/`
- **Event accumulator API**: `register(eventName)`, `waitFor(eventName, timeout)`, `getAll()`
- **Discovery task shape**: `{ description: string, action: 'click' | 'navigate' }`
- **Run state shape**: `{ steps: TestStep[], annotations: Record<string, string>, screenshotPaths: string[] }`
- **POST /api/runs** gains optional `steps: string[]` field
- **TestStep shape** unchanged: `{ title, duration, error? }`

---

## Phase 1: New entry point, delete old files

**User stories**: 1, 12, 15

### What to build

Create `test-runner.ts` as a direct merger of `spin.ts` and `spin-runner.ts` — identical behavior, single file. Update `command.ts` to invoke `test-runner.ts`. Delete `spin.ts`, `spin-runner.ts`, and any tests tied to their internals.

This is a no-behavior-change slice. Its only value is a clean slate for the phases that follow.

### Acceptance criteria

- [ ] A run triggered from the server completes successfully end-to-end
- [ ] `spin.ts` and `spin-runner.ts` are deleted from the repository
- [ ] `command.ts` references `test-runner.ts`
- [ ] `npm run check` passes

---

## Phase 2: Event accumulator

**User stories**: 4, 16

### What to build

Create `event-accumulator.ts`. It attaches to a Playwright page on creation and passively captures every console event. Exposes `register(eventName)` (documentation only), `waitFor(eventName, timeout)` (resolves immediately if already captured, else waits), and `getAll()` (filtered console lines).

Wire it into `test-runner.ts`: replace the inline `stdout` array, `setupSpinListeners`, and `filterStdout` with the accumulator. The spin cycle wait logic uses `accumulator.waitFor` instead of `page.waitForEvent`.

### Acceptance criteria

- [ ] A run completes successfully end-to-end
- [ ] Console logs in the result are identical to before
- [ ] `setupSpinListeners` and `filterStdout` are removed from `test-runner.ts`
- [ ] `npm run check` passes

---

## Phase 3: Modular step execution

**User stories**: 2, 3, 5, 13, 14

### What to build

Extract `game-load` and `spin-cycle` as standalone step modules under `src/server/lib/steps/`. Each module exports a `register(accumulator)` function and an `execute(page, context, state)` function.

`test-runner.ts` orchestrates a hardcoded steps list, passing run state through each step. Each step writes `TestStep` entries and annotations into the shared state. The entry script builds `InternalTestResult` from state after all steps complete or on failure.

### Acceptance criteria

- [ ] A run completes with the same `TestStep` breakdown as before
- [ ] `test-runner.ts` contains no inline step logic — it only orchestrates
- [ ] `npm run check` passes

---

## Phase 4: Generic discovery

**User stories**: 6, 7, 8, 9

### What to build

Refactor `discovery.ts` to accept a `DiscoveryTask { description, action }` instead of hardcoded spin-button knowledge. Create the `pre-spin-navigation` step module, which passes a `DiscoveryTask` from the steps config to the discovery engine and handles caching/replay.

### Acceptance criteria

- [ ] Discovery still finds the spin button for existing cached and un-cached games
- [ ] Replay still works from existing step caches
- [ ] `discovery.ts` has no hardcoded spin-button knowledge
- [ ] `npm run check` passes

---

## Phase 5: Steps config from frontend

**User stories**: 10, 11, 17, 18

### What to build

`POST /api/runs` accepts an optional `steps` array. `command.ts` passes `--steps=gameLoad,preSpinNavigation,spinCycle`. `test-runner.ts` parses `--steps` and maps each string to its step module. Frontend hardcodes the default steps array.

### Acceptance criteria

- [ ] Frontend run request includes `steps: ["gameLoad", "preSpinNavigation", "spinCycle"]`
- [ ] Server passes steps through CLI arg to `test-runner.ts`
- [ ] `test-runner.ts` maps step strings to modules dynamically
- [ ] Omitting `steps` from the request defaults to the three standard steps
- [ ] `npm run check` passes

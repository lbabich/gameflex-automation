# Architecture Deepening Opportunities

Three areas where shallow modules, implicit contracts, or scattered mutations are causing friction.
Ordered by priority for the current refactoring phase.

---

## 1. Step interface — implicit execution model

**Files:** `steps/types.ts`, `steps/spin-cycle.ts`, `steps/audio-toggle.ts`, `steps/game-close.ts`, `game-session-automation/index.ts`

**Problem:** Every step that supports discovery repeats the same pattern in its `execute` body: check the cache, call replay on a hit, call discover on a miss, wait for events, take screenshots. The merge of planned vs. actual results is handled one level up in `index.ts`. This pattern is not part of the `Step` interface — it is copy-pasted into each step. Delete any one step and the pattern reappears slightly differently in the others. A bug in the cache-check logic must be fixed in every step separately.

**Solution:** Move the cache-check / discover / replay decision into the `Step` interface itself (or into a shared execution harness the interface invokes). Each step declares only what is unique to it: how to discover, how to replay, what events to wait for. The shared execution model is tested once.

**Benefits:**
- *Locality:* the execution contract lives in one file; step implementations shrink to domain logic only
- *Leverage:* adding a new step no longer requires re-implementing the cache / replay pattern
- *Tests:* the execution model is testable without a browser; individual steps are testable by injecting a mock harness

---

## 2. Run lifecycle — state mutations spread across five services

**Files:** `run/runner.service.ts`, `run/run-state.service.ts`, `run/run-finalization.service.ts`, `run/persistence.ts`, `run/run-logger.service.ts`

**Problem:** Run record state transitions (`running → completed / error / cancelled`) happen across five services all mutating the same shared `Map`. Cleanup is triggered from three places; logging mutates shared state directly; `saveRunsIgnoreError` silently swallows persistence failures. You cannot test "what happens if finalization fails mid-GIF-generation" without setting up all five services and observing their shared mutable state. The error paths are scattered and some are never exercised by tests.

**Solution:** Introduce an explicit state machine with typed transitions — a single `transition(runId, event)` function that owns all state mutations. The five services become event emitters rather than direct state mutators. Error handling is a first-class transition (`FinalizationFailed`) rather than a silently swallowed exception.

**Benefits:**
- *Locality:* all mutation logic in one place; invariants (e.g. "a completed run cannot transition to running") are enforced centrally
- *Leverage:* the state machine is testable with plain objects; no service setup required
- *Tests:* error paths (finalization failure, mid-GIF cancellation) become expressible as state machine input sequences

---

## 3. Media pipeline — errors silently swallowed in finalization

**Files:** `run/run-finalization.service.ts`, `run/media.ts`, `run/gif-generator.ts`

**Problem:** After a run finishes, three operations run in sequence: attach screenshot URLs, generate and attach GIF URL, delete source PNGs. Each catches its own errors silently. If GIF generation fails, finalization still marks the run as complete — there is no observable indication that media processing failed. The pipeline is sequential but error handling is embedded at each step, making the overall success/failure state invisible from the outside.

**Solution:** Model the pipeline as a `MediaResult` — a typed value that captures which operations succeeded and which failed — and attach it to the final run record. Finalization is responsible for running the pipeline and recording its outcome, not for hiding failures. Silent catches become explicit partial-failure states.

**Benefits:**
- *Locality:* media pipeline success/failure is visible in one place on the run record
- *Leverage:* callers can inspect `mediaResult` to distinguish "run succeeded, GIF failed" from "run and media both succeeded"
- *Tests:* the pipeline is testable by injecting a failing GIF generator and asserting the `MediaResult` shape

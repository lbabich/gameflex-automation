# Architectural Deepening Plan

Opportunities to turn shallow modules into deep ones. Ordered by the number we discussed them.

---

## 4. SessionContext decomposition

**Files** — `steps/types.ts`, `steps/spin-cycle.ts`, `steps/game-load.ts`, `steps/audio-toggle.ts`, `steps/game-close.ts`, `runner.ts`

**Problem** — `SessionContext` has 8 fields. Each step accepts the full context even though it typically uses 2–3 fields. The interface is wider than any implementation needs, which means testing any step requires constructing the full context — including fields that step doesn't use.

**Solution** — Decompose SessionContext into narrower contexts (e.g. `PageContext`, `GameContext`) and have steps declare only the context shape they need.

**Benefits** — *Leverage*: callers and steps are coupled only to what they actually use. Test surface: testing a step that needs only `PageContext` doesn't require building a full 8-field SessionContext. Steps become more honest about their dependencies.

---

## 5. Output contract → explicit schema with typed errors

**Files** — `run/output/output-parser.ts`, `run/run-finalization.service.ts`

**Problem** — `parseSpinOutput()` returns empty/null on schema violations. If the game-session-automation runner changes its stdout format, finalization silently produces runs with no results. The contract is implicit — it lives in both the runner's output code and the parser's expectations, with no shared schema.

**Solution** — Make the output contract explicit with a schema (Zod or tagged discriminant). Finalization gets a typed parse error with detail when the contract is violated, not empty results.

**Benefits** — *Locality*: the contract lives in one place and is the authoritative source for both sides. *Leverage*: callers get actionable errors instead of debugging why run results are empty.

# Architectural Deepening Plan

Opportunities to turn shallow modules into deep ones. Ordered by the number we discussed them.

---

## 5. Output contract → explicit schema with typed errors

**Files** — `run/output/output-parser.ts`, `run/run-finalization.service.ts`

**Problem** — `parseSpinOutput()` returns empty/null on schema violations. If the game-session-automation runner changes its stdout format, finalization silently produces runs with no results. The contract is implicit — it lives in both the runner's output code and the parser's expectations, with no shared schema.

**Solution** — Make the output contract explicit with a schema (Zod or tagged discriminant). Finalization gets a typed parse error with detail when the contract is violated, not empty results.

**Benefits** — *Locality*: the contract lives in one place and is the authoritative source for both sides. *Leverage*: callers get actionable errors instead of debugging why run results are empty.

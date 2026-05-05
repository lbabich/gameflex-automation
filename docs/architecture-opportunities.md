# Architecture Deepening Opportunities

One area where shallow modules, implicit contracts, or scattered mutations are causing friction.

---

## 1. Media pipeline — errors silently swallowed in finalization

**Files:** `run/run-finalization.service.ts`, `run/media.ts`, `run/gif-generator.ts`

**Problem:** After a run finishes, three operations run in sequence: attach screenshot URLs, generate and attach GIF URL, delete source PNGs. Each catches its own errors silently. If GIF generation fails, finalization still marks the run as complete — there is no observable indication that media processing failed. The pipeline is sequential but error handling is embedded at each step, making the overall success/failure state invisible from the outside.

**Solution:** Model the pipeline as a `MediaResult` — a typed value that captures which operations succeeded and which failed — and attach it to the final run record. Finalization is responsible for running the pipeline and recording its outcome, not for hiding failures. Silent catches become explicit partial-failure states.

**Benefits:**
- *Locality:* media pipeline success/failure is visible in one place on the run record
- *Leverage:* callers can inspect `mediaResult` to distinguish "run succeeded, GIF failed" from "run and media both succeeded"
- *Tests:* the pipeline is testable by injecting a failing GIF generator and asserting the `MediaResult` shape

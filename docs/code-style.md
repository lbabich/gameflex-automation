# Code Style Guide

## Function declaration order

Functions in every file are ordered top-to-bottom by call depth — the reader should be able to start at the top and follow the logic downward without ever having to scroll back up.

### Rule

1. **Type declarations** at the top
2. **Constants** next
3. **The exported (or top-level entry) function** immediately after — this is the reader's entry point
4. **Helpers in call order** — every helper function appears *below* the first function that calls it, in the order it is called (depth-first)
5. **Deepest utilities last** — if a helper is shared by multiple callers, place it below the *last* function that calls it
6. **`export { ... }` statement** at the very bottom

### Examples

```ts
// ✓ correct — helpers below callers
export function run(options: RunOptions) {
  const result = validate(options);
  return execute(result);
}

function validate(options: RunOptions) { ... }   // called first by run
function execute(result: ValidResult) { ... }    // called second by run

export {}
```

```ts
// ✗ wrong — helpers hoisted above callers
function validate(options: RunOptions) { ... }   // called by run, must be below run
function execute(result: ValidResult) { ... }

export function run(options: RunOptions) {
  const result = validate(options);
  return execute(result);
}
```

### Shared helpers

When a helper is called by more than one function in the file, place it below the **last** function that calls it.

```ts
// ✓ correct — shared helper below both callers
function cancelRun(...) {
  cleanupActive(...);
}

function finalizeRun(...) {
  cleanupActive(...);
}

function cleanupActive(...) { ... }  // below both callers; last caller is finalizeRun
```

### In test files

`describe` blocks are the entry points. All helper functions (`makeX`, `buildX`, `makeTestRuntime`, etc.) go **after** the last `describe` block that calls them.

```ts
// ✓ correct
describe('MyService', () => {
  it('does the thing', () => {
    const data = makeData();
    ...
  });
});

function makeData() { ... }   // helper appears after the describe block

// ✗ wrong — helper hoisted above the describe
function makeData() { ... }

describe('MyService', () => {
  it('does the thing', () => {
    const data = makeData();
  });
});
```

---

## Blank-line conventions

These rules apply to all TypeScript files in this project.

### 1. If blocks — blank lines before and after

Always add a blank line before and after an `if` block (including `if/else if/else` chains). The blank line goes outside the block, not inside it.

```ts
// ✓ correct
const x = compute();

if (x > 0) {
  doSomething(x);
}

return x;

// ✗ wrong — no blank lines around the if
const x = compute();
if (x > 0) {
  doSomething(x);
}
return x;
```

Exception: when an `if` is the very first or very last statement in a block/function, the surrounding blank line on that side is optional.

---

### 2. Variable groups — blank line after

Consecutive `const`/`let`/`var` declarations that belong together stay on adjacent lines with no blank line between them. Put a blank line after the group when the next statement is something else.

```ts
// ✓ correct
const a = 1;
const b = 2;
const c = computeC(a, b);

doWork(a, b, c);

// ✗ wrong — blank line inside the group
const a = 1;

const b = 2;
const c = computeC(a, b);
doWork(a, b, c);
```

---

### 3. Multi-line function calls — blank lines around

When a single function call spans multiple lines, put a blank line before and after it.

```ts
// ✓ correct
const config = buildConfig();

await page.waitForEvent('console', {
  predicate: isSpinStart,
  timeout: SPIN_START_TIMEOUT_MS,
});

return result;

// ✗ wrong — no blank lines around the multi-line call
const config = buildConfig();
await page.waitForEvent('console', {
  predicate: isSpinStart,
  timeout: SPIN_START_TIMEOUT_MS,
});
return result;
```

---

### 4. Groups of single-line function calls — blank lines around the group

Consecutive single-line function calls that belong to the same logical step stay on adjacent lines. Put a blank line before the group and after the group.

```ts
// ✓ correct
const client = new Client(host, port);

client.setOption('timeout', 5000);
client.setOption('retries', 3);
client.connect();

for (const item of queue) {
  client.send(item);
}

// ✗ wrong — missing blank line before and after the group
const client = new Client(host, port);
client.setOption('timeout', 5000);
client.setOption('retries', 3);
client.connect();
for (const item of queue) {
  client.send(item);
}
```

---

### 5. Always a blank line before `return`

Every `return` statement gets a blank line before it.

```ts
// ✓ correct
const x = compute();

return x;

// ✗ wrong
const x = compute();
return x;
```

Exception: when `return` is the only statement in a function body, the blank line is optional.

---

### Summary table

| Construct | Blank line before | Blank line after |
|-----------|-------------------|-----------------|
| `if` / `if…else` block | ✓ | ✓ |
| Variable group (last line of group) | — | ✓ |
| Multi-line function call | ✓ | ✓ |
| Group of single-line calls (first/last line) | ✓ | ✓ |
| `return` statement | ✓ | — |

---

## Max 4 function parameters

No function may declare more than 4 parameters. When more inputs are needed, group
related parameters into named `type` aliases.

**Grouping strategies:**

```ts
// (a) single options object
function run(options: RunOptions): void

// (b) up to 4 logically grouped objects
function run(ctx: RunContext, config: RunConfig): void

// (c) single object with logically grouped keys
function run(options: { context: RunContext; config: RunConfig }): void
```

**React component props are exempt** — destructured props is already a single argument.

**Optional parameters count** — `fn(a, b, c, d?, e?)` is 5 params and is a violation.

---

## Effect service naming

Effect services have two exports: the Tag (the interface) and the implementation (the Layer).

| Export | Convention | Example |
|--------|-----------|---------|
| Tag / interface | `{Name}Service` | `FileService` |
| Node.js implementation | `Node{Name}Service` | `NodeFileService` |
| Test / in-memory implementation | `Test{Name}Service` | `TestFileService` |

```ts
// ✓ correct
export class FileService extends Effect.Tag('FileService')<...>() {}
export const NodeFileService = Layer.succeed(FileService, { ... })

// ✗ wrong — don't use the Live suffix
export const FileServiceLive = Layer.succeed(FileService, { ... })
```

The `Node` prefix signals that the implementation is Node.js-specific (disk, child processes, etc.). The `Test` prefix signals an in-memory fake used in unit tests.

---

## Effect error handling

Handle errors as close to the failing code as possible. If every caller recovers the same way, encapsulate the recovery inside the function — don't push it to the call site.

```ts
// ✓ correct — recovery is an implementation detail of parseJsonReport
export function parseJsonReport(raw: string) {
  return Effect.gen(function* () {
    const report = yield* extractReportJson(raw);
    // ...
  }).pipe(
    Effect.catchAll(() => Effect.succeed({ results: [], playwrightErrors: [] })),
  );
}

// ✗ wrong — caller forced to repeat the same recovery everywhere
const parsed = yield* parseJsonReport(stdout).pipe(
  Effect.catchTag('ParseError', () =>
    Effect.succeed({ results: [], playwrightErrors: [] }),
  ),
);
```

Only surface an error when callers have meaningfully different responses to it — the canonical example is route handlers, where `GameNotFoundError` → 404 and `DuplicateGameIDError` → 409 are distinct outcomes that belong at the HTTP boundary.

**`catchAll` vs `catchTag`:** Use `catchTag` only when you have multiple error types that need different recovery logic. Use `catchAll` when all errors recover the same way — adding tag specificity that provides no value is noise.

---

## Test variable naming

Every unit test uses three standard names:

| Name | Role |
|------|------|
| `SUT` | The system under test — assigned at the top of each `it` block |
| domain name (e.g. `steps`, `entry`) | Input data that also serves as the expected value |
| `result` | Whatever the SUT returned; always the variable passed to `expect()` |

```ts
// ✓ correct
it('round-trips steps by GUID', () => {
  const SUT = stepCache;
  const steps = { discoveredAt: '2024-01-01T00:00:00Z', steps: [] };

  SUT.setSteps(id, 'desktop', VP, steps);

  const result = SUT.getSteps(id, 'desktop', VP);

  expect(result).toEqual(steps);
});

// ✗ wrong — SUT not defined, result has an ambiguous name
it('round-trips steps by GUID', () => {
  const steps = { discoveredAt: '2024-01-01T00:00:00Z', steps: [] };

  stepCache.setSteps(id, 'desktop', VP, steps);

  const cached = stepCache.getSteps(id, 'desktop', VP);

  expect(cached).toEqual(steps);
});
```

**Effect service tests** — yield the service as `SUT`:

```ts
// ✓ correct
const result = await runtime.runPromise(
  Effect.gen(function* () {
    const SUT = yield* FileService;

    return yield* SUT.read(path);
  }),
);

expect(result).toBe('hello world');
```

**Error tests** — the value from `Effect.flip` is still named `result`:

```ts
// ✓ correct
const result = await runtime.runPromise(
  Effect.gen(function* () {
    const SUT = yield* GamesService;

    return yield* Effect.flip(SUT.add(duplicate));
  }),
);

expect(result).toBeInstanceOf(DuplicateGameIDError);
```

---

## Variable naming

Use full, descriptive names. Never use single-character or opaque abbreviations.

```ts
// ✓ correct
const game = gameList.find((entry) => entry.id === id);
const url = new URL(BASE_URL);
const response = await fetch(url.toString());
const key = viewportKey(viewport);

// ✗ wrong
const g = gameList.find((e) => e.id === id);
const u = new URL(BASE_URL);
const res = await fetch(u.toString());
const vk = viewportKey(viewport);
```

**Callback parameters** should reflect the element type: use `game`, `entry`, `filename`, `run`, `result`, `step`, `line` — not `g`, `e`, `f`, `r`, `s`, `t`.

**Exceptions** (universally understood conventions that are fine to keep):
- Sort comparators: `(a, b) => ...`
- Intentionally ignored destructuring: `({ rawOutput: _raw, ...rest })`
- Express route handler parameters: `req`, `res`, `next`

# Code Style Guide

## Blank-line conventions

These rules apply to all TypeScript files in this project. Follow them when writing or editing any code.

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
const encoder = new GIFEncoder(width, height);

encoder.setDelay(1000);
encoder.setRepeat(0);
encoder.start();

for (const frame of frames) {
  encoder.addFrame(frame);
}

// ✗ wrong — missing blank line before and after the group
const encoder = new GIFEncoder(width, height);
encoder.setDelay(1000);
encoder.setRepeat(0);
encoder.start();
for (const frame of frames) {
  encoder.addFrame(frame);
}
```

---

### Summary table

| Construct | Blank line before | Blank line after |
|-----------|-------------------|-----------------|
| `if` / `if…else` block | ✓ | ✓ |
| Variable group (last line of group) | — | ✓ |
| Multi-line function call | ✓ | ✓ |
| Group of single-line calls (first/last line) | ✓ | ✓ |

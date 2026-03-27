# TypeScript Conventions

## Use `type`, not `interface`

Use `type` for all object shape definitions. Never use `interface`.

```ts
// correct
type Step = {
  waitMs: number;
  clickPrompt: string | null;
};

// incorrect
interface Step {
  waitMs: number;
  clickPrompt: string | null;
}
```

## Acronym casing — `ID` not `Id`

Capitalize multi-letter abbreviations in full. `ID` is an abbreviation, so it is always uppercase when used as a suffix.

```ts
// correct
type RunRecord = { runID: string; gameIDs: string[] };
type GameEntry = { desktopGameID: string; mobileGameID?: string };

// incorrect — treat Id as if only one letter is abbreviated
type RunRecord = { runId: string; gameIds: string[] };
```

Standalone `id` fields (where the field IS the identifier, not a reference to one) stay lowercase, per JavaScript convention.

```ts
// correct — this field IS the object's own identifier
type GameEntry = { id: string; desktopGameID: string };
```

## Types and constants at the top

All module-level `type` and `const` declarations belong at the top of the file, never
interspersed between functions or classes. The expected order within a file is:

1. Imports
2. Side-effect calls (e.g. `dotenv.config()`)
3. `type` declarations
4. `const` declarations
5. Everything else (functions, classes, exports)

```ts
// ✓ correct
import { foo } from './foo';

type Config = { debug: boolean };

const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 5_000;

function doWork(config: Config) { ... }

// ✗ wrong — const buried after a function
import { foo } from './foo';

function helper() { ... }

const MAX_RETRIES = 3;

function doWork() { ... }
```

## Named types only — no inline shapes

Every object shape in a function signature or return type must have a named `type` alias.

```ts
// correct
type Viewport = { width: number; height: number };
type ClickContext = { gameID: string; deviceType: DeviceType };

function getClickCoords(viewport: Viewport, context: ClickContext): Promise<Coords> { ... }

// incorrect
function getClickCoords(
  viewport: { width: number; height: number },
  context: { gameId: string; deviceType: DeviceType },
): Promise<{ x: number; y: number }> { ... }
```

## Namespace import convention

All imports from internal `lib/` modules use `import * as moduleName`. Functions and types are
both accessed through the namespace.

```ts
// before
import { snap } from '../lib/screenshot';
import type { CachedStep } from '../lib/step-cache';

// after
import * as screenshot from '../lib/screenshot';
import * as stepCache from '../lib/step-cache';

// usage
screenshot.snap(page, name);
const steps: stepCache.CachedStep[] = [];
```

This makes every call site self-documenting — the module the function belongs to is visible
without reading the imports.

## No `.ts` extension on imports

Never include the `.ts` extension in import paths. TypeScript resolves modules without it.

```ts
// ✓ correct
import { addGame } from '../../lib/games';
import * as stepCache from '../../lib/step-cache';

// ✗ wrong
import { addGame } from '../../lib/games.ts';
import * as stepCache from '../../lib/step-cache.ts';
```

---

## Prefer inference over return types

Do not annotate function return types when TypeScript can infer them correctly.
Keep explicit annotations only when:

- TypeScript would infer `any` but `unknown` (or a narrower type) is intended
- A tuple type is required (e.g. `[number, number]`) — inference gives `number[]`
- A catch branch would cause an imprecise union (e.g. `loadCache(): StepCache` where
  the catch branch returns `{}` and inference would widen to `any`)
- Mutation widening — where TS infers a wider mutable type (e.g. `: RunRecord` on `createRunRecord`)

```ts
// correct — TypeScript infers Promise<string>
export async function snap(page: Page, name: string) {
  return path.resolve('screenshots', name);
}

// incorrect — redundant annotation
export async function snap(page: Page, name: string): Promise<string> {
  return path.resolve('screenshots', name);
}
```

### Never use annotations to work around inference failures

If TypeScript infers an unexpected type (wrong `R`, wrong `A`, unexpected `any`), do **not**
add an explicit return type annotation to silence the error. That hides the root cause and
may mask a genuine unsatisfied dependency.

Instead, investigate until you find the actual source — a missing `provideService`, a
`yield*` that leaks a tag, a function whose inferred return type is wider than expected.
Only annotate once you understand _why_ inference fails and have confirmed the annotation
is correct, not just that it makes the error disappear.

```ts
// WRONG — annotation silences a FileService leak without fixing it
function finalizeRun(...): Effect.Effect<void> {
  return Effect.gen(function* () { ... });
}

// CORRECT — investigate why FileService appears in the inferred R, fix the source
function finalizeRun(...) {
  return Effect.gen(function* () { ... });
}
```

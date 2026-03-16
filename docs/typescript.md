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

function doWork(config: Config): void { ... }

// ✗ wrong — const buried after a function
import { foo } from './foo';

function helper(): void { ... }

const MAX_RETRIES = 3;

function doWork(): void { ... }
```

## Named types only — no inline shapes

Every object shape in a function signature or return type must have a named `type` alias.

```ts
// correct
type Viewport = { width: number; height: number };
type ClickContext = { gameId: string; deviceType: DeviceType };

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

## Prefer inference over return types

Do not annotate function return types when TypeScript can infer them correctly.
Keep explicit annotations only when:

- TypeScript would infer `any` but `unknown` (or a narrower type) is intended
- A tuple type is required (e.g. `[number, number]`) — inference gives `number[]`
- A catch branch would cause an imprecise union (e.g. `loadCache(): StepCache` where
  the catch branch returns `{}` and inference would widen to `any`)

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

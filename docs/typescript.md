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

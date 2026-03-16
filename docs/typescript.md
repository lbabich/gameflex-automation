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

## Types at the top

Declare all types at the top of the file, after imports and before any constants or functions.

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

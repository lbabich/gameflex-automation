# gameflex-automation — Agent Guidelines

## Code Standards

### TypeScript

- **Prefer `type` over `interface`.**
  Use `type` for all object shape definitions. Do not use `interface`.

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

- **Declare all types at the top of the file**, after imports and before any constants or functions.

- **Always use named types — never inline object shapes.**
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

- **Separate every logical step with a blank line** inside function bodies.
  Use blank lines before and after `if` blocks, between unrelated statements, and always before `return`.
  Closely related consecutive statements (e.g. `mkdir` + `writeFile`) may be kept together.

  ```ts
  // correct
  const cache = loadCache();
  const vk = viewportKey(viewport);

  cache[gameId] ??= {};
  cache[gameId][deviceType][vk][prompt] = coords;

  saveCache(cache);

  // incorrect
  const cache = loadCache();
  const vk = viewportKey(viewport);
  cache[gameId] ??= {};
  cache[gameId][deviceType][vk][prompt] = coords;
  saveCache(cache);
  ```

## Tooling

- **Linter / Formatter:** [Biome](https://biomejs.dev/) v2.x
- **Run before committing:**
  ```
  npm run check
  ```
- Biome must be run from the project root (not via an absolute path argument).
  Use the subshell pattern if CWD is unreliable:
  ```
  (cd "C:/dev/gameflex/gameflex-automation" && node_modules/.bin/biome check --write .)
  ```

## Environment

- Copy `.env.example` to `.env` and fill in all variables before running tests.
- Required variables: `GAME_URL`, `ANTHROPIC_API_KEY`

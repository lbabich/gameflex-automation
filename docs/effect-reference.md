# Effect Primitives Reference

Every Effect primitive used in this codebase, with a minimal example and a note on where it appears.

---

## The core type

### `Effect<A, E, R>`

The fundamental unit of work. A lazy description of a computation that:
- produces a value of type `A` on success
- fails with a value of type `E` on error
- requires services of type `R` to run

Nothing executes until you explicitly run it. This separates description from execution.

```ts
// A computation that produces a string, may fail with GameNotFoundError,
// and requires GamesService to be provided.
type Example = Effect<string, GameNotFoundError, GamesService>
```

`R = never` means no services required. `E = never` means cannot fail.

---

## Writing Effects

### `Effect.gen`

Generator-based syntax. Write Effects like `async/await` — `yield*` replaces `await`.

```ts
import { Effect } from 'effect'

const getGameName = (id: string) =>
  Effect.gen(function* () {
    const games = yield* GamesService.list()      // like: const games = await listGames()
    const game = games.find(g => g.id === id)

    if (!game) {
      yield* Effect.fail(new GameNotFoundError({ id }))
    }

    return game.name
  })
```

Use `Effect.gen` for any flow with more than one step.

---

### `Effect.succeed`

Wrap a plain value in an Effect that always succeeds.

```ts
import { Effect } from 'effect'

const answer = Effect.succeed(42)
// Effect<number, never, never>
```

Use this when you have a value in hand and need to return it from an Effect context.

---

### `Effect.fail`

Create a typed failure. The error value is captured in the `E` type parameter.

```ts
import { Effect } from 'effect'

const notFound = (id: string) =>
  Effect.fail(new GameNotFoundError({ id }))
// Effect<never, GameNotFoundError, never>
```

Use inside `Effect.gen` when a business rule is violated.

---

### `Effect.sync`

Wrap a synchronous function that is guaranteed not to throw. The `E` type is `never` — no failure is possible.

```ts
import { Effect } from 'effect'

const getGames = Effect.sync(() => {
  return readGames()
})
// Effect<GameEntry[], never, never>
```

Use this when the function handles its own errors internally (like `readGames`, which returns `[]` on failure) or when a failure would be truly unexpected and should surface as a defect. If the function *can* throw in normal operation, use `Effect.try` instead.

---

### `Effect.try`

Wrap a synchronous function that might throw. Converts the thrown value into a typed error.

```ts
import { Effect } from 'effect'

const parseJson = (raw: string) =>
  Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (err) => new ParseError({ message: String(err) }),
  })
// Effect<unknown, ParseError, never>
```

Use for `JSON.parse`, `fs.readFileSync`, or any third-party sync call that can throw.

---

### `Effect.async`

Wrap callback-based async code (like Node.js event emitters). The callback receives a `resume` function — call it once with `Effect.succeed(value)` or `Effect.fail(error)`.

The optional return value is a cleanup Effect that runs if the fiber is interrupted (e.g. when a run is cancelled).

```ts
import { Effect } from 'effect'
import { spawn } from 'node:child_process'

const runProcess = (cmd: string) =>
  Effect.async<string, SpawnError>((resume) => {
    const chunks: Buffer[] = []
    const proc = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    proc.on('close', () => resume(Effect.succeed(Buffer.concat(chunks).toString())))
    proc.on('error', (err) => resume(Effect.fail(new SpawnError({ message: err.message }))))

    // Returned cleanup runs when the fiber is interrupted (i.e. cancelRun)
    return Effect.sync(() => proc.kill())
  })
```

Used in `RunnerService` to wrap the Playwright child process lifecycle.

---

### `Effect.forkDaemon`

Spawn a background fiber. The fiber runs independently — it keeps going after the parent Effect returns, and it keeps going even if the parent scope ends.

```ts
import { Effect } from 'effect'

const startRun = (gameIds: string[]) =>
  Effect.gen(function* () {
    const record = buildRunRecord(gameIds)

    // Returns immediately with the record; process runs in the background
    yield* Effect.forkDaemon(runPlaywrightProcess(record.runId))

    return record
  })
```

Used in `RunnerService.startRun` so `POST /api/runs` returns immediately while the test process runs.

---

## Error handling

### `Effect.catchTag`

Handle one specific tagged error and recover. The `_tag` field on `Data.TaggedError` classes is the discriminant.

```ts
import { Effect } from 'effect'

const handler = GamesService.get(id).pipe(
  Effect.catchTag('GameNotFoundError', () => Effect.succeed(null)),
)
// If get() fails with GameNotFoundError, returns null instead of failing
```

Used in route handlers to map domain errors to HTTP status codes (e.g. `GameNotFoundError` → 404).

---

## Running Effects

### `Effect.runPromise`

Execute an Effect and return a native `Promise`. This is the boundary between Effect code and non-Effect code (Express route handlers).

```ts
import { Effect } from 'effect'

app.get('/api/games', (req, res) => {
  Effect.runPromise(GamesService.list()).then(games => res.json(games))
})
```

Every Express route handler calls `runtime.runPromise(effect)` — see `ManagedRuntime` below.

---

## Defining services

### `class X extends Effect.Tag`

Define a typed service interface. The string argument is the service's unique identifier. The second type parameter is the interface — the set of methods callers can use.

```ts
import { Effect } from 'effect'

class GamesService extends Effect.Tag('GamesService')<
  GamesService,
  {
    list: () => Effect.Effect<GameEntry[]>
    add: (input: NewGame) => Effect.Effect<GameEntry, DuplicateGameIdError>
  }
>() {}

// Call it from anywhere an Effect is expected:
const names = Effect.gen(function* () {
  const games = yield* GamesService.list()
  return games.map(g => g.name)
})
// Effect<string[], never, GamesService>  ← GamesService is in R, meaning it's required
```

The `R` type parameter accumulates required services automatically as you `yield*` them.

---

## Providing implementations

### `Layer.effect`

Build a service implementation whose constructor may itself use Effects (e.g. reading config, initialising state).

```ts
import { Layer, Effect } from 'effect'

const NodeGamesService = Layer.effect(
  GamesService,
  Effect.gen(function* () {
    // Constructor can yield* other effects (e.g. read a config value)
    return {
      list: () => Effect.try({ try: () => readGames(), catch: (e) => new FileReadError(...) }),
      add: (input) => Effect.try({ try: () => addGame(input), catch: (e) => new DuplicateGameIdError(...) }),
    }
  }),
)
```

Use `Layer.effect` when the service needs to do async work or access other services during construction.

---

### `Layer.succeed`

Build a service implementation from a plain object. No constructor Effects needed.

```ts
import { Layer, Effect } from 'effect'

// In-memory test implementation — no disk, no process
const TestNodeFileService = Layer.succeed(FileService, {
  read: (_path) => Effect.succeed('[]'),
  write: (_path, _content) => Effect.succeed(undefined),
  exists: (_path) => Effect.succeed(false),
})
```

Used in unit tests to replace `FileServiceLive` with an in-memory version.

---

### `ManagedRuntime`

A long-lived runtime that holds pre-built services. Create it once at server startup and reuse it for every request.

```ts
import { ManagedRuntime, Layer } from 'effect'

const AppLayer = Layer.mergeAll(
  NodeConfigService,
  NodeFileService,
  NodeGamesService,
  NodeRunnerService,
)

const runtime = ManagedRuntime.make(AppLayer)

// In a route handler:
app.get('/api/games', (req, res) => {
  runtime.runPromise(GamesService.list()).then(games => res.json(games))
})
```

Avoids rebuilding Layers on every request. Lives in `src/server/runtime.ts`.

---

## Validation

### `Schema.Struct`

Declare the shape of a data structure. Used at route boundaries to describe what a request body must look like.

```ts
import { Schema } from 'effect'

const PatchGameBody = Schema.Struct({
  name: Schema.optional(Schema.String),
  desktopPlaymode: Schema.optional(Schema.Literal('demo', 'real')),
  mobileEnabled: Schema.optional(Schema.Boolean),
})

// The inferred type:
type PatchGameBody = typeof PatchGameBody.Type
// { name?: string; desktopPlaymode?: 'demo' | 'real'; mobileEnabled?: boolean }
```

---

### `Schema.decodeUnknown`

Parse an unknown value (e.g. `req.body`) against a Schema. Returns an Effect that succeeds with the typed value or fails with a parse error.

```ts
import { Schema, Effect } from 'effect'

const handler = Effect.gen(function* () {
  const body = yield* Schema.decodeUnknown(PatchGameBody)(req.body)
  // body is fully typed here — no typeof checks needed
  yield* GamesService.update(req.params.id, body)
})
```

Replaces all the manual `typeof x !== 'string'` guards in the route handlers.

---

## Configuration

### `Config.string` / `Config.number`

Read an environment variable with a declared type. Validated at startup when the Layer is constructed — the server refuses to start if a required var is missing.

```ts
import { Config, Effect } from 'effect'

const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const corsOrigin = yield* Config.string('CORS_ORIGIN').pipe(
      Config.withDefault('http://localhost:5173'),
    )
    const gameUrl = yield* Config.string('GAME_URL')  // required — fails at startup if absent

    return { corsOrigin, gameUrl }
  }),
)
```

---

## Error modelling

### `Data.TaggedError`

Base class for typed domain errors. Each subclass gets a `_tag` string discriminant, which `Effect.catchTag` uses to distinguish error types at the type level.

```ts
import { Data } from 'effect'

class GameNotFoundError extends Data.TaggedError('GameNotFoundError')<{
  id: string
}> {}

// Usage:
const err = new GameNotFoundError({ id: 'abc-123' })
err._tag   // 'GameNotFoundError'
err.id     // 'abc-123'
err.message // auto-generated from fields
```

All server error classes are defined in `src/server/errors.ts`.

---

## Quick-reference table

| Primitive | One-line purpose | Introduced in |
|---|---|---|
| `Effect<A, E, R>` | Core type: value / error / requirements | All files |
| `Effect.gen` | Write Effects like async/await | Commits 6–11 |
| `Effect.succeed` | Wrap a plain value | Commits 4–11 |
| `Effect.fail` | Return a typed error | Commits 6–10 |
| `Effect.sync` | Wrap sync code that cannot fail | Commit 6 |
| `Effect.try` | Wrap sync code that can throw | Commits 4, 6, 11 |
| `Effect.async` | Wrap callback-based async | Commit 7 |
| `Effect.forkDaemon` | Fire-and-forget background fiber | Commit 7 |
| `Fiber.interrupt` | Stop a running fiber (triggers cleanup) | Commit 7 |
| `Effect.catchAll` | Handle all errors and recover | Commits 7, 9, 10 |
| `Effect.flatMap` | Chain effects where the next depends on the previous value | Commit 7 |
| `Effect.catchTag` | Handle one specific error type | Commits 9, 10 |
| `Effect.runPromise` | Run an Effect → Promise (Express boundary) | Commits 8–10 |
| `Effect.Tag` (class) | Define a typed service interface | Commits 4–7 |
| `Layer.effect` | Build a service (constructor uses Effects) | Commits 5–7 |
| `Layer.succeed` | Build a service from a plain object | Commits 4, 12 |
| `ManagedRuntime` | Shared runtime with pre-built services | Commit 8 |
| `Schema.Struct` | Declare a data shape | Commits 9, 10 |
| `Schema.decodeUnknown` | Parse unknown → typed value | Commits 9, 10 |
| `Config.string` | Read an env var at startup | Commit 5 |
| `Config.withDefault` | Provide a fallback for optional vars | Commit 5 |
| `Data.TaggedError` | Typed domain error with `_tag` discriminant | Commit 2 |

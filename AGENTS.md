# gameflex-automation

TypeScript + Playwright automation suite that records and replays casino game UI flows using Claude Vision.

## Before committing

```
npm run check
```

## Architecture

See `docs/architecture.md` for the module map, data flow, and cross-module type contracts.
Start there before reading any `lib/` file.

## Docs

```
docs/
  architecture.md  Module map, data flow, cross-module types, key invariants
  typescript.md    TypeScript conventions (type vs interface, named types, file structure)
  code-style.md    Blank-line formatting rules (5 rules + summary table)
  tooling.md       Biome linter/formatter, subshell pattern
  environment.md   .env setup and required variables
```

## Critical rules

These rules are non-negotiable. Do not bypass them without explicit user approval.

### TypeScript — no annotation workarounds

If TypeScript infers an unexpected type, **find the root cause**. Do not add an explicit
return type annotation to silence the error. See `docs/typescript.md` — "Never use
annotations to work around inference failures".

Acceptable reasons to add an explicit return type:
- TypeScript infers `any`
- A tuple is required and inference gives an array
- A catch branch widens the type incorrectly
- Mutation widening (e.g. `: RunRecord` on `createRunRecord`)

Not acceptable:
- Silencing an unexpected `R` (requirements) in an Effect return type
- Making a TS2345 error disappear without understanding why it appeared

### TypeScript — `type` not `interface`

Always use `type` for object shapes. Never use `interface`.

### Max 4 function parameters

No function may declare more than 4 parameters. When more inputs are needed, group
related parameters into named objects. Up to 4 objects is fine; a single object is also fine.

Legal grouping strategies:

```ts
// (a) single options object
function run(options: RunOptions): void

// (b) logically grouped objects — up to 4 args total
function run(ctx: RunContext, config: RunConfig): void

// (c) single object with logically grouped keys
function run(options: { context: RunContext; config: RunConfig }): void
```

**React component props are exempt.** A component that destructures `Props` still
receives a single argument at the call site, so it does not violate this rule no matter
how many keys `Props` has.

**Optional parameters count.** `fn(a, b, c, d?, e?)` declares 5 parameters and is a
violation even though two are optional.

### No `useEffect` for state synchronisation

Do not use `useEffect` to sync or reset React state. Use `key` prop remounting or
derived state instead.

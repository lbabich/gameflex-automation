# Plan: Replace `DiscoverySpec` Callbacks with `DiscoveryProfile`

## Problem

`DiscoverySpec` is the interface every step must implement to participate in discovery. It is
a five-property struct where four properties are functions:

```ts
type DiscoverySpec<TCtx> = {
  stepName: string;
  defaultInstructions: (viewport: Viewport) => string;  // function
  failureContext: (list: string) => string;              // function
  getHint: (hints: RunHints) => string | undefined;     // function
  verifyClick: (ctx: TCtx, x, y) => Promise<boolean>;  // function
  checkComplete?: (ctx: TCtx) => Promise<boolean>;      // function
};
```

Each step implements this spec inline. The prompt strings are multi-line template literals
(15–30 lines each), viewport math is repeated, and the spec shape forces each step to reach
*into* discovery's internals via callbacks.

Friction this causes:
- Three of four steps share an identical `getHint` shape (`hints?.spinCycle`, `hints?.audioToggle`,
  `hints?.gameClose`) — but the callback forces each to re-express it
- Two of four steps share an identical `checkComplete` shape (`stepUtils.gelCheck(event)`) —
  same problem
- `verifyClick` for spinCycle and gameClose is `stepUtils.onGelEvent(event, ms)` — a one-liner
  that is wrapped in a callback solely because the spec demands a function
- The only step with genuinely custom `verifyClick` logic is `audioToggle` (which re-clicks
  and waits for either of two events simultaneously)
- Prompt text is distributed across four step files — changing the prompt structure means
  touching all four

Deletion test: delete the spec callbacks from each step, and each step still needs to express
*what* to look for — but that knowledge is data (event names, hint keys, exclusion rules),
not functions that reach across a seam.

## Solution

Replace `DiscoverySpec` with a `DiscoveryProfile` — a data record. Discovery owns the
prompt-building and the verification logic; steps own only the profile values.

```ts
type DiscoveryProfile = {
  stepName: string;
  hintKey?: keyof RunHints;
  instructions: string | ((viewport: Viewport) => string);
  failureInstructions: string;
  verifyEvent?: GelEventName;
  checkEvent?: GelEventName;
  customVerify?: (ctx: FullStepContext, x: number, y: number) => Promise<boolean>;
};
```

### How each spec property maps

| Old (callback) | New (data) |
|---|---|
| `getHint: hints => hints?.spinCycle` | `hintKey: 'spinCycle'` — discovery does the lookup |
| `defaultInstructions: vp => "..."` | `instructions: vp => "..."` — same, kept as-is |
| `failureContext: list => "..."` | `failureInstructions: "..."` — static string; discovery interpolates the failed-button list |
| `verifyClick: stepUtils.onGelEvent(E, ms)` | `verifyEvent: E` — discovery builds the verifier |
| `checkComplete: stepUtils.gelCheck(E)` | `checkEvent: E` — discovery builds the checker |
| `verifyClick: async(ctx,x,y) => ...` (audioToggle) | `customVerify: async(ctx,x,y) => ...` — escape hatch |

### Discovery changes

`discoverTarget` accepts a `DiscoveryProfile` instead of a `DiscoverySpec`. Internally it:
1. Builds `verifyClick` from `verifyEvent` OR falls back to `customVerify`
2. Builds `checkComplete` from `checkEvent` OR leaves undefined
3. Resolves `hint` via `profile.hintKey ? hints?.[profile.hintKey] : undefined`
4. Passes `instructions` and `failureInstructions` as before (the prompt builder is unchanged)

The loop body is unchanged. The only change is in how the spec fields are resolved before
the loop starts.

## Files Affected

| Action | File |
|--------|------|
| Modify | `src/core/game-session-automation/discovery.ts` — new `DiscoveryProfile` type, update `discoverTarget` signature |
| Modify | `src/core/game-session-automation/steps/spin-cycle.ts` |
| Modify | `src/core/game-session-automation/steps/audio-toggle.ts` |
| Modify | `src/core/game-session-automation/steps/game-close.ts` |
| Delete | `src/core/game-session-automation/steps/step-utils.ts` — `onGelEvent` and `gelCheck` become internal to discovery |

## What Gets Simpler Per Step

### `spin-cycle.ts`
- `getHint: hints => hints?.spinCycle` → `hintKey: 'spinCycle'`
- `verifyClick: stepUtils.onGelEvent(SPIN_START, ms)` → `verifyEvent: 'spinStart'`
- `checkComplete: stepUtils.gelCheck(SPIN_START)` → `checkEvent: 'spinStart'`
- `failureContext` template → `failureInstructions` static string (discovery interpolates `{failedList}`)

### `game-close.ts`
- Same pattern as spinCycle

### `audio-toggle.ts`
- `getHint: hints => hints?.audioToggle` → `hintKey: 'audioToggle'`
- `verifyClick` custom inline function → `customVerify` (unchanged in content, renamed to escape hatch)
- No `checkComplete` (none today, none after)
- The `try/catch` around `discoverTarget` that swallows `DiscoveryError` stays in `audio-toggle.ts`
  since it's step-level policy, not discovery policy

### `game-load.ts`
- No `DiscoverySpec` today — unaffected

## Step-Utils Fate

`step-utils.ts` currently exports `onGelEvent` and `gelCheck`. After this change:
- `onGelEvent` logic moves into discovery as an internal builder (not exported)
- `gelCheck` logic moves into discovery as an internal builder (not exported)
- `step-utils.ts` becomes empty → delete it

## Key Invariants Preserved

- The discovery loop logic is unchanged
- The prompt text for each step is unchanged (instructions remain per-step)
- `audioToggle`'s custom click-then-wait verification is preserved via `customVerify`
- The `DiscoveryError` escape in `audioToggle.discover` is unchanged

## Testability After

A `DiscoveryProfile` is a plain data object — it can be constructed in a test and passed to
`discoverTarget` without implementing callback functions. Testing "does this profile produce
the right verification behavior?" requires only a mock `accumulator`, not a full step
implementation.

## Work Estimate

Small. Mechanical substitution across 3 step files + discovery.ts. The prompt text
doesn't change. The only real logic move is `onGelEvent` and `gelCheck` from `step-utils`
into discovery internals.

## Open Questions (for grilling)

1. `instructions` is kept as `string | ((viewport: Viewport) => string)` because the viewport
   pixel math (`Math.round(height * 0.08)`) can't be pre-computed. Is that acceptable, or
   should viewport injection use a different mechanism (template variables, a builder step)?

2. Should `failureInstructions` be a static string with a `{failedList}` placeholder, or
   should it remain a `(list: string) => string` function? The static-string approach is
   cleaner but requires discovery to do the interpolation.

3. `customVerify` keeps the old callback signature `(ctx, x, y) => Promise<boolean>`.
   Should this be the permanent escape hatch shape, or is there a better way to express
   audioToggle's "click and wait for either of two events" pattern as data?

# Plan: GEL Event Contract

## Problem

Steps verify game completion by matching hardcoded strings (`'SPIN_START'`, `'gel.close'`) against console log output. These strings appear in at least two places — the accumulator (which listens for them) and the step specs (which pass them as expected events). A rename is a silent bug, and there is no single place to look up the full set of known events.

The accumulator is shallow: deleting it would push an identical string-matching loop into every caller.

## Solution

Define a `GameEvent` type (string literal union or const object) in the game-session-automation domain. The accumulator's interface accepts and emits `GameEvent` values. Step specs reference `GameEvent.SpinStart` rather than the raw string `'SPIN_START'`.

## Files

- `src/core/game-session-automation/accumulator.ts` — change string parameters to `GameEvent`
- New file: `src/core/game-session-automation/game-events.ts` — defines `GameEvent` type and const
- Step spec files that pass event name strings (spinCycle, audioToggle, gameClose)
- `src/core/game-session-automation/game-session-automation.module.ts` — export `GameEvent` if needed by callers

## Steps

1. Create `game-events.ts` with a const object and derived string literal union:
   ```ts
   export const GameEvent = {
     SpinStart: 'SPIN_START',
     SpinEnd: 'SPIN_END',
     GelClose: 'gel.close',
     // add others as discovered
   } as const;
   export type GameEvent = (typeof GameEvent)[keyof typeof GameEvent];
   ```

2. Update `accumulator.ts` — replace raw string parameters and comparisons with `GameEvent`.

3. Update each step spec that passes an event string — replace with `GameEvent.X`.

4. Run `npm run check` and confirm no new type errors.

## Test Impact

- Existing tests pass unchanged.
- New tests of the accumulator can now use `GameEvent` values as fixtures rather than magic strings.
- TypeScript catches unknown event names at compile time.

## Effort

Small. Pure rename + type introduction. No logic changes. ~1–2 hours.

# Plan: Discovery VisionAnalyzer Seam

## Problem

The discovery loop calls Claude Vision directly, baked into its implementation. There is no place in the code where "analyze this screenshot" can be swapped for different behavior — no seam. One adapter (the real Claude call) means a hypothetical seam, not a real one.

Discovery's retry logic, false-positive handling, and `allFailedButtons` reset behavior cannot be tested without network calls and real screenshots. The loop is the hardest thing to get right (it represents days of tuning for each new game), yet it has zero test coverage.

## Solution

Extract a `VisionAnalyzer` module at the seam where discovery calls Claude. Discovery calls `visionAnalyzer.analyze(screenshotPath, context)` and receives a typed response. The Claude implementation is one adapter; a scripted test adapter returning pre-canned sequences is the second. Two adapters = a real seam.

## Files

- New: `src/core/game-session-automation/vision-analyzer.ts` — defines the `VisionAnalyzer` interface and the `ClaudeVisionAnalyzer` implementation
- `src/core/game-session-automation/discovery/discovery.ts` — inject `VisionAnalyzer` rather than calling Claude directly
- `src/lib/claude-vision.ts` (or equivalent) — becomes the implementation detail behind `ClaudeVisionAnalyzer`
- New: `src/core/game-session-automation/discovery/discovery.test.ts` — unit tests using `TestVisionAnalyzer`

## Interface Shape

```ts
type VisionAnalyzeResult =
  | { found: true; x: number; y: number; label: string }
  | { found: false; nextTarget?: { x: number; y: number; label: string } };

type VisionAnalyzer = {
  analyze(screenshotPath: string, context: VisionContext): Promise<VisionAnalyzeResult>;
};
```

`VisionContext` carries whatever the prompt needs: failed button positions, game title, attempt number.

## Steps

1. Define `VisionAnalyzeResult` and `VisionAnalyzer` types.

2. Extract `ClaudeVisionAnalyzer` — move the Anthropic SDK call and prompt construction here. Validate the JSON response against a strict schema (see plan 01 for pattern). This module owns the Claude prompt text, API key usage, and response parsing.

3. Refactor `discovery.ts` to accept a `VisionAnalyzer` parameter (or Effect tag). Replace direct Claude calls with `visionAnalyzer.analyze(...)`.

4. Write `TestVisionAnalyzer` — accepts a queue of scripted `VisionAnalyzeResult` responses and returns them in order.

5. Write `discovery.test.ts` using `TestVisionAnalyzer`:
   - Test: not found × N, then found → steps array has correct length and final click.
   - Test: false positive (navigation) → `allFailedButtons` resets, loop continues.
   - Test: exhausts all attempts → discovery fails with appropriate error.

6. Wire `ClaudeVisionAnalyzer` into the game-session-automation DI setup.

7. Run `npm run check` and the new tests.

## Test Impact

Before this plan: zero test coverage of discovery logic.
After: the retry loop, false-positive handling, and button blacklist reset are all covered by fast, deterministic unit tests — no Playwright, no Anthropic API.

## Effort

Large. New interface + two adapters + test suite. ~1 day. High leverage — pays off every time a new game needs debugging.

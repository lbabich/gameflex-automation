import { Effect, type Fiber, Layer } from 'effect';
import type { InternalRunRecord } from '../types';

export class RunStateService extends Effect.Tag('RunStateService')<
  RunStateService,
  {
    runs: Map<string, InternalRunRecord>;
    activeRunsByGame: Map<string, string>;
    activeFibers: Map<string, Fiber.RuntimeFiber<void, never>>;
  }
>() {}

export const NodeRunStateService = Layer.succeed(RunStateService, {
  runs: new Map(),
  activeRunsByGame: new Map(),
  activeFibers: new Map(),
});

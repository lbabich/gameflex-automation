import type { EventAccumulator } from '../gel/accumulator';
import type { GelEvent } from '../gel/events';

function onGelEvent(event: GelEvent, timeoutMs: number) {
  return (ctx: { accumulator: EventAccumulator }, _x: number, _y: number): Promise<boolean> => {
    return ctx.accumulator
      .waitFor(event, timeoutMs)
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  };
}

function gelCheck(event: GelEvent) {
  return (ctx: { accumulator: EventAccumulator }): Promise<boolean> => {
    return ctx.accumulator
      .waitFor(event, 0)
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  };
}

export const stepUtils = { onGelEvent, gelCheck };

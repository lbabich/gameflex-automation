import type { EventAccumulator } from '../gel/accumulator';

function onGelEvent(event: string, timeoutMs: number) {
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

function gelCheck(event: string) {
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

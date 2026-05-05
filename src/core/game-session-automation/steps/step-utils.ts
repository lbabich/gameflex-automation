import type { SessionContext } from './types';

export function onGelEvent(event: string, timeoutMs: number) {
  return (ctx: SessionContext, _x: number, _y: number): Promise<boolean> => {
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

export function gelCheck(event: string) {
  return (ctx: SessionContext): Promise<boolean> => {
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

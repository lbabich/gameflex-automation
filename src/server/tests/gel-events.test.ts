import { describe, expect, it } from 'vitest';
import * as gelEvents from '../lib/gel-events';

// Minimal stub that lets tests emit console messages on demand.
// Both page.on and page.waitForEvent share the same handler list so a single
// emit() call triggers all active listeners in registration order.

type ConsoleStub = { text: () => string };

// Use a short timeout so the timeout test completes quickly.
const SHORT_TIMEOUT = 50;

describe('waitForGameReady', () => {
  it('returns hadLoadProgress: false when gel.ready fires with no prior load.progress', async () => {
    const { page, emit } = makePageStub();
    const SUT = gelEvents;

    const result = SUT.waitForGameReady(page as never, SHORT_TIMEOUT);

    // Small delay so Date.now() advances before gel.ready resolves,
    // confirming loadTimeMs is measured rather than hardcoded to zero.
    await new Promise((resolve) => {
      return setTimeout(resolve, 5);
    });
    emit('gel.ready');

    const { hadLoadProgress, loadTimeMs } = await result;

    expect(hadLoadProgress).toBe(false);
    expect(loadTimeMs).toBeGreaterThan(0);
  });

  it('returns hadLoadProgress: true when gel.load.progress fires before gel.ready', async () => {
    const { page, emit } = makePageStub();
    const SUT = gelEvents;

    const result = SUT.waitForGameReady(page as never, SHORT_TIMEOUT);

    emit('gel.load.progress {"percent": 50}');
    emit('gel.ready');

    expect((await result).hadLoadProgress).toBe(true);
  });

  it('throws SlowLoadError when gel.ready does not fire within timeout', async () => {
    const { page } = makePageStub();
    const SUT = gelEvents;

    await expect(SUT.waitForGameReady(page as never, SHORT_TIMEOUT)).rejects.toBeInstanceOf(
      SUT.SlowLoadError,
    );
  });

  it('includes elapsed milliseconds in SlowLoadError message', async () => {
    const { page } = makePageStub();
    const SUT = gelEvents;

    const result = await SUT.waitForGameReady(page as never, SHORT_TIMEOUT).catch((err) => {
      return err;
    });

    expect(result).toBeInstanceOf(SUT.SlowLoadError);
    expect(result.message).toMatch(/\d+ms/);
  });
});

function makePageStub() {
  type Handler = (msg: ConsoleStub) => void;

  const handlers: Handler[] = [];

  const page = {
    on(_event: string, handler: Handler) {
      handlers.push(handler);
    },
    off(_event: string, handler: Handler) {
      const idx = handlers.indexOf(handler);

      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    },
    waitForEvent(
      _event: string,
      opts: { predicate: (msg: ConsoleStub) => boolean; timeout: number },
    ) {
      return new Promise<ConsoleStub>((resolve, reject) => {
        const timer = setTimeout(() => {
          return reject(new Error(`Timeout ${opts.timeout}ms exceeded`));
        }, opts.timeout);

        const check = (msg: ConsoleStub) => {
          if (opts.predicate(msg)) {
            clearTimeout(timer);

            const idx = handlers.indexOf(check);

            if (idx !== -1) {
              handlers.splice(idx, 1);
            }

            resolve(msg);
          }
        };

        handlers.push(check);
      });
    },
  };

  function emit(text: string) {
    const msg: ConsoleStub = {
      text: () => {
        return text;
      },
    };

    for (const handler of [...handlers]) {
      handler(msg);
    }
  }

  return { page, emit };
}

import type { Page } from '@playwright/test';

type EventAccumulator = {
  register: (eventName: string) => void;
  waitFor: (eventName: string, timeout: number) => Promise<void>;
  getAll: () => string[];
};

type EventAccumulatorModule = {
  createEventAccumulator: typeof createEventAccumulator;
};

function createEventAccumulator(page: Page): EventAccumulator {
  const captured: string[] = [];
  const waiters = new Map<string, Array<() => void>>();

  page.on('console', (msg) => {
    const text = msg.text();

    captured.push(text);

    for (const [eventName, resolvers] of waiters.entries()) {
      if (text.includes(eventName)) {
        for (const resolve of resolvers) {
          resolve();
        }

        waiters.delete(eventName);
      }
    }
  });

  return {
    register: (_eventName: string) => {
      // All events are always captured; register is for documentation only.
    },
    waitFor: (eventName: string, timeout: number) => {
      if (
        captured.some((line) => {
          return line.includes(eventName);
        })
      ) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          const pending = waiters.get(eventName);

          if (pending) {
            const idx = pending.indexOf(onFire);

            if (idx !== -1) {
              pending.splice(idx, 1);
            }
          }

          reject(new Error(`Timed out waiting for event '${eventName}' after ${timeout}ms`));
        }, timeout);

        function onFire() {
          clearTimeout(timer);
          resolve();
        }

        const pending = waiters.get(eventName) ?? [];

        pending.push(onFire);
        waiters.set(eventName, pending);
      });
    },
    getAll: () => {
      return captured
        .map((line) => {
          return line.trimEnd();
        })
        .filter((line) => {
          return line && !line.startsWith('Screenshot saved:');
        });
    },
  };
}

export type { EventAccumulator, EventAccumulatorModule };
export { createEventAccumulator };

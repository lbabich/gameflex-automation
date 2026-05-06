import type { Page } from '@playwright/test';
import type { GelEvent } from './events';

export type EventAccumulator = {
  waitFor: (eventName: GelEvent, timeout: number) => Promise<void>;
  getAll: () => string[];
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
    waitFor: (eventName: GelEvent, timeout: number) => {
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
            const idx = pending.indexOf(clean);

            if (idx !== -1) {
              pending.splice(idx, 1);
            }
          }

          reject(new Error(`Timed out waiting for event '${eventName}' after ${timeout}ms`));
        }, timeout);

        function clean() {
          clearTimeout(timer);
          resolve();
        }

        const pending = waiters.get(eventName) ?? [];

        pending.push(clean);
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

export const accumulator = { createEventAccumulator };

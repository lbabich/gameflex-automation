import type { TestStep } from '../../../shared/types';

type TrackModule = {
  track: typeof track;
};

async function track<T>(steps: TestStep[], title: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();

    steps.push({ title, duration: Date.now() - start });

    return result;
  } catch (err) {
    steps.push({
      title,
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });

    throw err;
  }
}

export type { TrackModule };
export { track };

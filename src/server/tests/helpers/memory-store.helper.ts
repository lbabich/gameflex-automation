import type { StepCache, StepStore } from '../../lib/step-store';

function createMemoryStore(initial: StepCache = {}): StepStore {
  let data: StepCache = initial;

  return {
    load() {
      return data;
    },

    save(cache: StepCache) {
      data = cache;
    },
  };
}

export { createMemoryStore };

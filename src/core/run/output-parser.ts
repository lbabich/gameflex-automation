import { Effect } from 'effect';
import type { DeviceType, TestResult } from '../../shared/types';

export function parseSpinOutput(json: string) {
  return Effect.try({
    try: () => {
      const parsed = JSON.parse(json) as {
        results: Partial<Record<DeviceType, TestResult>>;
        errors: string[];
      };

      return { results: parsed.results, errors: parsed.errors };
    },
    catch: (error) => {
      return error instanceof Error ? error : new Error(String(error));
    },
  });
}

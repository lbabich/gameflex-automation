import { Effect } from 'effect';
import type { DeviceType, TestResult } from '../../shared/types';

function parseSpinOutput(stdout: string) {
  return Effect.try({
    try: () => {
      const jsonStart = stdout.indexOf('{"results":');

      if (jsonStart === -1) {
        throw new Error('No JSON output found in stdout');
      }

      const parsed = JSON.parse(stdout.slice(jsonStart)) as {
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

export { parseSpinOutput };

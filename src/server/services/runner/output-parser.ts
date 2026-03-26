import { Effect } from 'effect';
import type { DeviceType, TestResult } from '../../../shared/types';

function parseSpinOutput(stdout: string) {
  return Effect.sync(() => {
    try {
      const jsonStart = stdout.indexOf('{"results":');

      if (jsonStart === -1) {
        throw new Error('No JSON output found in stdout');
      }

      const parsed = JSON.parse(stdout.slice(jsonStart)) as {
        results: Partial<Record<DeviceType, TestResult>>;
        errors: string[];
      };

      console.log(
        `[runner] Parsed ${Object.keys(parsed.results).length} result(s), ${parsed.errors.length} error(s)`,
      );

      return { results: parsed.results, errors: parsed.errors };
    } catch (error) {
      console.error('[runner] Failed to parse spin output:', error);
      console.error('[runner] stdout snippet:', stdout.slice(0, 200));

      return {
        results: {} as Partial<Record<DeviceType, TestResult>>,
        errors: [] as string[],
      };
    }
  });
}

export { parseSpinOutput };

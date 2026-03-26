import * as path from 'node:path';
import { Effect } from 'effect';
import type { FileWriteError } from '../../errors';
import type { InternalRunRecord } from '../../types';
import { FileService } from '../file.service';

export const RUNS_FILE = path.resolve('src/server/data/runs.json');

function loadRuns() {
  return Effect.gen(function* () {
    const fileService = yield* FileService;

    return yield* fileService.read(RUNS_FILE).pipe(
      Effect.flatMap((content: string) => {
        return Effect.try({
          try: () => {
            return JSON.parse(content) as InternalRunRecord[];
          },
          catch: () => {
            return [] as InternalRunRecord[];
          },
        });
      }),
      Effect.catchAll(() => {
        return Effect.succeed([] as InternalRunRecord[]);
      }),
    );
  });
}

function saveRuns(runs: Map<string, InternalRunRecord>) {
  return Effect.gen(function* () {
    const fileService = yield* FileService;

    const completed = [...runs.values()].filter((run: InternalRunRecord) => {
      return run.status !== 'running';
    });

    const toSave = completed
      .sort((runA: InternalRunRecord, runB: InternalRunRecord) => {
        return new Date(runB.startedAt).getTime() - new Date(runA.startedAt).getTime();
      })
      .slice(0, 10)
      .map(({ rawOutput: _raw, ...rest }: InternalRunRecord) => {
        return rest;
      });

    yield* fileService.write(RUNS_FILE, JSON.stringify(toSave, null, 2));
  }).pipe(
    Effect.catchAll((error: FileWriteError) => {
      console.error('[runner] Failed to save runs:', error);

      return Effect.succeed(undefined);
    }),
  );
}

function trimMemory(runs: Map<string, InternalRunRecord>) {
  if (runs.size <= 10) {
    return;
  }

  const oldest = [...runs.entries()]
    .sort(([, runA]: [string, InternalRunRecord], [, runB]: [string, InternalRunRecord]) => {
      return runA.startedAt < runB.startedAt ? -1 : 1;
    })
    .slice(0, runs.size - 10);

  for (const [id] of oldest) {
    runs.delete(id);
  }
}

export { loadRuns, saveRuns, trimMemory };

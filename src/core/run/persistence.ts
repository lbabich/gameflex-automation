import * as path from 'node:path';
import { Effect } from 'effect';
import { FileService } from '../file.service';
import type { InternalRunRecord } from '../types';

export const RUNS_FILE = path.resolve('src/core/data/runs.json');

export function loadRuns() {
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

export function saveRuns(fileService: FileService['Type'], runs: Map<string, InternalRunRecord>) {
  return Effect.gen(function* () {
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
  });
}

export function trimMemory(runs: Map<string, InternalRunRecord>) {
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

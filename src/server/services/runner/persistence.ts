import * as path from 'node:path';
import { Effect } from 'effect';
import { FileService } from '../file.service';
import type { RunRecord } from './types';

export const RUNS_FILE = path.resolve('src/server/data/runs.json');

function loadRuns() {
  return Effect.gen(function* () {
    const fileService = yield* FileService;

    return yield* fileService.read(RUNS_FILE).pipe(
      Effect.flatMap((content) => {
        return Effect.try({
          try: () => {
            return JSON.parse(content) as RunRecord[];
          },
          catch: () => {
            return [] as RunRecord[];
          },
        });
      }),
      Effect.catchAll(() => {
        return Effect.succeed([] as RunRecord[]);
      }),
    );
  });
}

function saveRuns(runs: Map<string, RunRecord>) {
  return Effect.gen(function* () {
    const fileService = yield* FileService;

    const completed = [...runs.values()].filter((run) => {
      return run.status !== 'running';
    });

    const toSave = completed
      .sort((a, b) => {
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      })
      .slice(0, 10)
      .map(({ rawOutput: _raw, ...rest }) => {
        return rest;
      });

    yield* fileService.write(RUNS_FILE, JSON.stringify(toSave, null, 2));
  }).pipe(
    Effect.catchAll((error) => {
      console.error('[runner] Failed to save runs:', error);

      return Effect.succeed(undefined);
    }),
  );
}

function trimMemory(runs: Map<string, RunRecord>) {
  if (runs.size <= 10) {
    return;
  }

  const oldest = [...runs.entries()]
    .sort(([, a], [, b]) => {
      return a.startedAt < b.startedAt ? -1 : 1;
    })
    .slice(0, runs.size - 10);

  for (const [id] of oldest) {
    runs.delete(id);
  }
}

export { loadRuns, saveRuns, trimMemory };

import { Effect, Schema } from 'effect';
import { Router } from 'express';
import type { AppRuntime } from '../runtime';
import { RunnerService } from '../services/runner/runner.service';

const PostBody = Schema.Struct({
  gameIDs: Schema.NonEmptyArray(Schema.String),
  projects: Schema.optional(Schema.Array(Schema.String)),
});

export function makeRunsRouter(runtime: AppRuntime): Router {
  const router = Router();

  router.post('/', (req, res) => {
    void runtime.runPromise(
      Effect.gen(function* () {
        const body = yield* Schema.decodeUnknown(PostBody)(req.body);
        const runnerService = yield* RunnerService;

        const record = yield* runnerService.startRun(
          [...body.gameIDs],
          body.projects ? [...body.projects] : undefined,
        );

        res.status(201).json(record);
      }).pipe(
        Effect.catchTag('ParseError', () => {
          return Effect.sync(() => {
            res.status(400).json({ error: 'gameIDs must be a non-empty array of strings' });
          });
        }),
        Effect.catchTag('RunAlreadyActiveError', (error) => {
          return Effect.sync(() => {
            res.status(409).json({ error: `Run already active for game '${error.gameID}'` });
          });
        }),
        Effect.catchTag('GameNotFoundError', (error) => {
          return Effect.sync(() => {
            res.status(404).json({ error: `Game '${error.id}' not found` });
          });
        }),
      ),
    );
  });

  router.get('/', (_req, res) => {
    void runtime.runPromise(
      Effect.gen(function* () {
        const runnerService = yield* RunnerService;
        const runs = yield* runnerService.getRecentRuns(50);

        res.json(runs);
      }),
    );
  });

  router.get('/:id', (req, res) => {
    const { id } = req.params;

    void runtime.runPromise(
      Effect.gen(function* () {
        const runnerService = yield* RunnerService;
        const record = yield* runnerService.getRun(id);

        res.json(record);
      }).pipe(
        Effect.catchTag('RunNotFoundError', () => {
          return Effect.sync(() => {
            res.status(404).json({ error: 'Run not found' });
          });
        }),
      ),
    );
  });

  router.delete('/:id', (req, res) => {
    const { id } = req.params;

    void runtime.runPromise(
      Effect.gen(function* () {
        const runnerService = yield* RunnerService;

        yield* runnerService.cancelRun(id);

        res.sendStatus(204);
      }).pipe(
        Effect.catchTag('RunNotFoundError', () => {
          return Effect.sync(() => {
            res.status(404).json({ error: 'Run not found or not active' });
          });
        }),
      ),
    );
  });

  return router;
}

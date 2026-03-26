import { Effect, Schema } from 'effect';
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { GameNotFoundError, RunAlreadyActiveError } from '../errors';
import type { AppRuntime } from '../runtime';
import { RunnerService } from '../services/runner/runner.service';

const PostBody = Schema.Struct({
  gameIDs: Schema.NonEmptyArray(Schema.String),
  deviceTypes: Schema.NonEmptyArray(Schema.Literal('desktop', 'mobile')),
  playmode: Schema.Literal('demo', 'real'),
});

function makeRunsRouter(runtime: AppRuntime) {
  const router = Router();

  router.post('/', (req: Request, res: Response) => {
    void runtime.runPromise(
      Effect.gen(function* () {
        const body = yield* Schema.decodeUnknown(PostBody)(req.body);
        const runnerService = yield* RunnerService;

        const record = yield* runnerService.startRun(
          [...body.gameIDs],
          [...body.deviceTypes],
          body.playmode,
        );

        res.status(201).json(record);
      }).pipe(
        Effect.catchTag('ParseError', () => {
          return Effect.sync(() => {
            res.status(400).json({ error: 'gameIDs, deviceTypes, and playmode are required' });
          });
        }),
        Effect.catchTag('RunAlreadyActiveError', (error: RunAlreadyActiveError) => {
          return Effect.sync(() => {
            res.status(409).json({ error: `Run already active for game '${error.gameID}'` });
          });
        }),
        Effect.catchTag('GameNotFoundError', (error: GameNotFoundError) => {
          return Effect.sync(() => {
            res.status(404).json({ error: `Game '${error.id}' not found` });
          });
        }),
        Effect.catchAllDefect((defect: unknown) => {
          console.error('[server] Unhandled defect:', defect);

          return Effect.sync(() => {
            if (!res.headersSent) {
              res.status(500).json({ error: 'Internal server error' });
            }
          });
        }),
      ),
    );
  });

  router.get('/', (_req: Request, res: Response) => {
    void runtime.runPromise(
      Effect.gen(function* () {
        const runnerService = yield* RunnerService;
        const runs = yield* runnerService.getRecentRuns();

        res.json(runs);
      }).pipe(
        Effect.catchAllDefect((defect: unknown) => {
          console.error('[server] Unhandled defect:', defect);

          return Effect.sync(() => {
            if (!res.headersSent) {
              res.status(500).json({ error: 'Internal server error' });
            }
          });
        }),
      ),
    );
  });

  router.get('/:id', (req: Request<Record<string, string>>, res: Response) => {
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
        Effect.catchAllDefect((defect: unknown) => {
          console.error('[server] Unhandled defect:', defect);

          return Effect.sync(() => {
            if (!res.headersSent) {
              res.status(500).json({ error: 'Internal server error' });
            }
          });
        }),
      ),
    );
  });

  router.delete('/:id', (req: Request<Record<string, string>>, res: Response) => {
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
        Effect.catchAllDefect((defect: unknown) => {
          console.error('[server] Unhandled defect:', defect);

          return Effect.sync(() => {
            if (!res.headersSent) {
              res.status(500).json({ error: 'Internal server error' });
            }
          });
        }),
      ),
    );
  });

  return router;
}

export { makeRunsRouter };

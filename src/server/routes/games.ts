import { Effect, Schema } from 'effect';
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { DuplicateGameIDError, GameNotFoundError } from '../errors';
import type { DeviceType } from '../lib/types';
import { DEVICE_TYPES } from '../lib/types';
import type { AppRuntime } from '../runtime';
import { GamesService } from '../services/games.service';

const PostBody = Schema.Struct({
  desktopGameID: Schema.String,
  mobileGameID: Schema.optional(Schema.String),
  name: Schema.String,
  gameProviderID: Schema.String,
});

const PatchBody = Schema.Struct({
  name: Schema.optional(Schema.String),
  desktopGameID: Schema.optional(Schema.String),
  mobileGameID: Schema.optional(Schema.String),
  gameProviderID: Schema.optional(Schema.String),
});

function makeGamesRouter(runtime: AppRuntime) {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    void runtime.runPromise(
      Effect.gen(function* () {
        const gamesService = yield* GamesService;
        const games = yield* gamesService.list();
        const deviceCache = yield* gamesService.getCachedDeviceMap();

        res.json(
          games.map((game) => {
            const cache = deviceCache.get(game.id) ?? { desktop: false, mobile: false };

            return { ...game, desktopCached: cache.desktop, mobileCached: cache.mobile };
          }),
        );
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

  router.post('/', (req: Request, res: Response) => {
    void runtime.runPromise(
      Effect.gen(function* () {
        const body = yield* Schema.decodeUnknown(PostBody)(req.body);
        const gamesService = yield* GamesService;

        yield* gamesService.add({
          desktopGameID: body.desktopGameID,
          mobileGameID: body.mobileGameID,
          name: body.name,
          gameProviderID: body.gameProviderID,
        });

        res.status(201).json({ desktopGameID: body.desktopGameID });
      }).pipe(
        Effect.catchTag('ParseError', () => {
          return Effect.sync(() => {
            res
              .status(400)
              .json({ error: 'desktopGameID, name, and gameProviderID are required strings' });
          });
        }),
        Effect.catchTag('DuplicateGameIDError', (err: DuplicateGameIDError) => {
          return Effect.sync(() => {
            res
              .status(409)
              .json({ error: `Game with desktopGameID '${err.desktopGameID}' already exists` });
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

  router.patch('/:id', (req: Request<Record<string, string>>, res: Response) => {
    const { id } = req.params;

    void runtime.runPromise(
      Effect.gen(function* () {
        const body = yield* Schema.decodeUnknown(PatchBody)(req.body);
        const gamesService = yield* GamesService;

        yield* gamesService.update(id, body);

        res.sendStatus(204);
      }).pipe(
        Effect.catchTag('ParseError', () => {
          return Effect.sync(() => {
            res.status(400).json({ error: 'Invalid field types' });
          });
        }),
        Effect.catchTag('GameNotFoundError', (err: GameNotFoundError) => {
          return Effect.sync(() => {
            res.status(404).json({ error: `Game '${err.id}' not found` });
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

  router.delete('/:id/steps', (req: Request<Record<string, string>>, res: Response) => {
    const { id } = req.params;

    void runtime.runPromise(
      Effect.gen(function* () {
        const gamesService = yield* GamesService;

        yield* gamesService.clearAllSteps(id);
        res.sendStatus(204);
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

  router.delete('/:id/steps/:channel', (req: Request<Record<string, string>>, res: Response) => {
    const { id, channel } = req.params;

    if (!DEVICE_TYPES.includes(channel as DeviceType)) {
      res.status(400).json({ error: 'channel must be desktop or mobile' });
      return;
    }

    void runtime.runPromise(
      Effect.gen(function* () {
        const gamesService = yield* GamesService;

        yield* gamesService.clearSteps(id, channel as DeviceType);
        res.sendStatus(204);
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

  return router;
}

export { makeGamesRouter };

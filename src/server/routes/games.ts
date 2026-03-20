import { Effect, Schema } from 'effect';
import { Router } from 'express';
import type { DeviceType } from '../../lib/types';
import { DEVICE_TYPES, PLAY_MODE } from '../../lib/types';
import type { AppRuntime } from '../runtime';
import { GamesService } from '../services/games';

const PostBody = Schema.Struct({
  desktopGameID: Schema.String,
  mobileGameID: Schema.optional(Schema.String),
  name: Schema.String,
});

const PatchBody = Schema.Struct({
  name: Schema.optional(Schema.String),
  desktopGameID: Schema.optional(Schema.String),
  mobileGameID: Schema.optional(Schema.String),
  desktopEnabled: Schema.optional(Schema.Boolean),
  desktopPlaymode: Schema.optional(Schema.Literal('demo', 'real')),
  mobileEnabled: Schema.optional(Schema.Boolean),
  mobilePlaymode: Schema.optional(Schema.Literal('demo', 'real')),
});

export function makeGamesRouter(runtime: AppRuntime) {
  const router = Router();

  router.get('/', (_req, res) => {
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
      }),
    );
  });

  router.post('/', (req, res) => {
    void runtime.runPromise(
      Effect.gen(function* () {
        const body = yield* Schema.decodeUnknown(PostBody)(req.body);
        const gamesService = yield* GamesService;

        yield* gamesService.add({
          desktopGameID: body.desktopGameID,
          mobileGameID: body.mobileGameID,
          name: body.name,
          desktopEnabled: true,
          desktopPlaymode: PLAY_MODE.DEMO,
          mobileEnabled: false,
          mobilePlaymode: PLAY_MODE.DEMO,
        });

        res.status(201).json({ desktopGameID: body.desktopGameID });
      }).pipe(
        Effect.catchTag('ParseError', () => {
          return Effect.sync(() => {
            res.status(400).json({ error: 'desktopGameID and name are required strings' });
          });
        }),
        Effect.catchTag('DuplicateGameIDError', (err) => {
          return Effect.sync(() => {
            res
              .status(409)
              .json({ error: `Game with desktopGameID '${err.desktopGameID}' already exists` });
          });
        }),
      ),
    );
  });

  router.patch('/:id', (req, res) => {
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
        Effect.catchTag('GameNotFoundError', (err) => {
          return Effect.sync(() => {
            res.status(404).json({ error: `Game '${err.id}' not found` });
          });
        }),
      ),
    );
  });

  router.delete('/:id/steps', (req, res) => {
    const { id } = req.params;

    void runtime.runPromise(
      Effect.gen(function* () {
        const gamesService = yield* GamesService;

        yield* gamesService.clearAllSteps(id);
        res.sendStatus(204);
      }),
    );
  });

  router.delete('/:id/steps/:channel', (req, res) => {
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
      }),
    );
  });

  return router;
}

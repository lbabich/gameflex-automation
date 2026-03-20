import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect, ManagedRuntime } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DuplicateGameIDError, GameNotFoundError } from '../../server/errors';
import { GamesService, NodeGamesService } from '../../server/services/games';

const GAMES_PATH = path.resolve('src', 'data', 'games.json');
const runtime = ManagedRuntime.make(NodeGamesService);

let savedGames: string;

beforeAll(() => {
  savedGames = fs.existsSync(GAMES_PATH) ? fs.readFileSync(GAMES_PATH, 'utf8') : '[]';
});

afterAll(() => {
  fs.writeFileSync(GAMES_PATH, savedGames);
});

function makeEntry() {
  return {
    desktopGameID: `test-${crypto.randomUUID()}`,
    name: 'Test Game',
    desktopEnabled: true as const,
    desktopPlaymode: 'demo' as const,
    mobileEnabled: false as const,
    mobilePlaymode: 'demo' as const,
  };
}

describe('GamesService', () => {
  it('list returns games that have been added', async () => {
    const entry = makeEntry();

    const games = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        yield* service.add(entry);

        return yield* service.list();
      }),
    );

    expect(
      games.some((game) => {
        return game.desktopGameID === entry.desktopGameID;
      }),
    ).toBe(true);
  });

  it('add fails with DuplicateGameIDError for a duplicate desktopGameID', async () => {
    const entry = makeEntry();

    const error = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        yield* service.add(entry);

        return yield* Effect.flip(service.add(entry));
      }),
    );

    expect(error).toBeInstanceOf(DuplicateGameIDError);
  });

  it('update fails with GameNotFoundError for an unknown id', async () => {
    const error = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* GamesService;

        return yield* Effect.flip(service.update('nonexistent', { name: 'New Name' }));
      }),
    );

    expect(error).toBeInstanceOf(GameNotFoundError);
  });
});

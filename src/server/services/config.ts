import { Config, Effect, Layer } from 'effect';

export class ConfigService extends Effect.Tag('ConfigService')<
  ConfigService,
  {
    corsOrigin: string;
  }
>() {}

export const NodeConfigService = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const corsOrigin = yield* Config.string('CORS_ORIGIN').pipe(
      Config.withDefault('http://localhost:5173'),
    );

    return { corsOrigin };
  }),
);

import { Effect, ManagedRuntime } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigService, NodeConfigService } from '../../server/services/config.service';

describe('ConfigService', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGIN;
  });

  it('corsOrigin defaults to http://localhost:5173 when CORS_ORIGIN is unset', async () => {
    delete process.env.CORS_ORIGIN;

    const runtime = ManagedRuntime.make(NodeConfigService);

    const result = await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* ConfigService;

        return SUT.corsOrigin;
      }),
    );

    expect(result).toBe('http://localhost:5173');
  });

  it('corsOrigin returns the env value when CORS_ORIGIN is set', async () => {
    process.env.CORS_ORIGIN = 'http://example.com:3000';

    const runtime = ManagedRuntime.make(NodeConfigService);

    const result = await runtime.runPromise(
      Effect.gen(function* () {
        const SUT = yield* ConfigService;

        return SUT.corsOrigin;
      }),
    );

    expect(result).toBe('http://example.com:3000');
  });
});

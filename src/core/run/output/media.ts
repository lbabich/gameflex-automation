import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect } from 'effect';
import type { DeviceType } from '../../../shared/types';
import type { InternalTestResult, MediaDeviceResult, MediaResult } from '../../types';
import { SCREENSHOTS_DIR } from '../../types';
import type { RunLoggerService } from '../run-logger.service';
import { gifGenerator } from './gif-generator';

type MediaPipelineOutput = {
  mediaResult: MediaResult;
  results: Partial<Record<DeviceType, InternalTestResult>>;
};

type DeviceOutput = {
  media: MediaDeviceResult;
  result: InternalTestResult;
};

type DeviceCleanupResult = {
  updatedResult: InternalTestResult;
  cleanup: MediaDeviceResult['cleanup'];
};

type GifOutcome = { gif: 'ok'; gifUrl: string } | { gif: { error: string } };

function computeScreenshotUrls(
  results: Partial<Record<DeviceType, InternalTestResult>>,
): Partial<Record<DeviceType, InternalTestResult>> {
  const screenshotsBase = path.resolve(SCREENSHOTS_DIR);
  const entries = Object.entries(results) as [DeviceType, InternalTestResult][];

  return Object.fromEntries(
    entries.map(([deviceType, result]) => {
      const paths = result?.screenshotPaths;

      if (!paths?.length) {
        return [deviceType, result];
      }

      const lastPath = paths[paths.length - 1];
      const relativePath = path.relative(screenshotsBase, lastPath).replace(/\\/g, '/');

      return [deviceType, { ...result, screenshotUrls: [`/api/screenshots/${relativePath}`] }];
    }),
  );
}

function runMediaPipeline(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  results: Partial<Record<DeviceType, InternalTestResult>>,
): Effect.Effect<MediaPipelineOutput> {
  const entries = (Object.entries(results) as [DeviceType, InternalTestResult][]).filter(
    ([, result]) => {
      return result != null;
    },
  );

  return Effect.forEach(
    entries,
    ([deviceType, result]) => {
      return Effect.map(processDevice(runLoggerService, runID, deviceType, result), (output) => {
        return [deviceType, output] as [DeviceType, DeviceOutput];
      });
    },
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.map((outputs) => {
      return outputs.reduce<MediaPipelineOutput>(
        (pipeline, [deviceType, output]) => {
          return {
            mediaResult: { ...pipeline.mediaResult, [deviceType]: output.media },
            results: { ...pipeline.results, [deviceType]: output.result },
          };
        },
        { mediaResult: {}, results: {} },
      );
    }),
  );
}

function processDevice(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  deviceType: DeviceType,
  result: InternalTestResult,
) {
  return Effect.gen(function* () {
    const outcome = yield* attachGifUrl(runLoggerService, runID, deviceType);

    // gif-generator already deletes PNGs on success; only clean up manually if gif failed
    const { updatedResult, cleanup } =
      outcome.gif === 'ok'
        ? withGifAndClearPaths(result, outcome.gifUrl)
        : yield* deleteScreenshotFiles(runLoggerService, runID, result);

    return { media: { gif: outcome.gif, cleanup }, result: updatedResult };
  });
}

function attachGifUrl(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  deviceType: DeviceType,
): Effect.Effect<GifOutcome> {
  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => {
        return gifGenerator.generateGif(runID, deviceType);
      },
      catch: (err: unknown) => {
        return String(err);
      },
    });

    return {
      gif: 'ok' as const,
      gifUrl: `/api/screenshots/${runID}/${deviceType}/${gifGenerator.ANIMATED_GIF_FILENAME}`,
    };
  }).pipe(
    Effect.catchAll((errStr) => {
      return runLoggerService
        .warn(runID, 'media', `Failed to generate GIF for ${deviceType}: ${errStr}`)
        .pipe(Effect.as({ gif: { error: errStr } }));
    }),
  );
}

function withGifAndClearPaths(result: InternalTestResult, gifUrl: string): DeviceCleanupResult {
  return {
    updatedResult: { ...result, gifUrl, screenshotPaths: undefined },
    cleanup: 'ok',
  };
}

function deleteScreenshotFiles(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  result: InternalTestResult,
): Effect.Effect<DeviceCleanupResult> {
  const paths = result.screenshotPaths;
  const updatedResult: InternalTestResult = { ...result, screenshotPaths: undefined };

  if (!paths || paths.length <= 1) {
    return Effect.succeed({ updatedResult, cleanup: 'ok' });
  }

  let lastError: string | undefined;

  for (let i = 0; i < paths.length - 1; i++) {
    try {
      fs.unlinkSync(paths[i]);
    } catch (err) {
      lastError = String(err);
    }
  }

  if (!lastError) {
    return Effect.succeed({ updatedResult, cleanup: 'ok' });
  }

  return runLoggerService
    .warn(runID, 'media', `Failed to delete screenshot: ${lastError}`)
    .pipe(Effect.as({ updatedResult, cleanup: { error: lastError } }));
}

export const media = { computeScreenshotUrls, runMediaPipeline };

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect } from 'effect';
import type { DeviceType } from '../../../shared/types';
import type { InternalTestResult, MediaDeviceResult, MediaResult } from '../../types';
import { SCREENSHOTS_DIR } from '../../types';
import type { RunLoggerService } from '../run-logger.service';
import * as gifGenerator from './gif-generator';

export function attachScreenshotUrls(results: Partial<Record<DeviceType, InternalTestResult>>) {
  return Effect.sync(() => {
    const screenshotsBase = path.resolve(SCREENSHOTS_DIR);

    for (const result of Object.values(results)) {
      if (!result) {
        continue;
      }

      const paths = result.screenshotPaths;

      if (!paths?.length) {
        continue;
      }

      const lastPath = paths[paths.length - 1];
      const relativePath = path.relative(screenshotsBase, lastPath).replace(/\\/g, '/');

      result.screenshotUrls = [`/api/screenshots/${relativePath}`];
    }
  });
}

export function runMediaPipeline(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  results: Partial<Record<DeviceType, InternalTestResult>>,
): Effect.Effect<MediaResult> {
  const entries = (Object.entries(results) as [DeviceType, InternalTestResult][]).filter(
    ([, result]) => {
      return result != null;
    },
  );

  return Effect.forEach(
    entries,
    ([deviceType, result]) =>
      Effect.gen(function* () {
        const gif = yield* attachGifUrl(runLoggerService, runID, deviceType, result);

        // gif-generator already deletes PNGs on success; only clean up manually if gif failed
        const cleanup =
          gif === 'ok'
            ? clearScreenshotPaths(result)
            : yield* deleteScreenshotFiles(runLoggerService, runID, result);

        return [deviceType, { gif, cleanup }] as [DeviceType, MediaDeviceResult];
      }),
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.map((pairs) => {
      return Object.fromEntries(pairs) as MediaResult;
    }),
  );
}

function attachGifUrl(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  deviceType: DeviceType,
  result: InternalTestResult,
): Effect.Effect<MediaDeviceResult['gif']> {
  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => {
        return gifGenerator.generateGif(runID, deviceType);
      },
      catch: (err: unknown) => {
        return String(err);
      },
    });

    result.gifUrl = `/api/screenshots/${runID}/${deviceType}/${gifGenerator.ANIMATED_GIF_FILENAME}`;

    return 'ok' as const;
  }).pipe(
    Effect.catchAll((errStr) => {
      return runLoggerService
        .warn(runID, 'media', `Failed to generate GIF for ${deviceType}: ${errStr}`)
        .pipe(Effect.as({ error: errStr }));
    }),
  );
}

function clearScreenshotPaths(result: InternalTestResult): MediaDeviceResult['cleanup'] {
  result.screenshotPaths = undefined;

  return 'ok';
}

function deleteScreenshotFiles(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  result: InternalTestResult,
): Effect.Effect<MediaDeviceResult['cleanup']> {
  const paths = result.screenshotPaths;

  result.screenshotPaths = undefined;

  if (!paths || paths.length <= 1) {
    return Effect.succeed('ok');
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
    return Effect.succeed('ok');
  }

  return runLoggerService
    .warn(runID, 'media', `Failed to delete screenshot: ${lastError}`)
    .pipe(Effect.as({ error: lastError }));
}

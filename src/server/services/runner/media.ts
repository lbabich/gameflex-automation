import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect } from 'effect';
import type { DeviceType } from '../../../shared/types';
import * as gifGenerator from '../../lib/gif-generator';
import { SCREENSHOTS_DIR } from '../../lib/screenshot';
import type { InternalTestResult } from '../../types';
import type { RunLoggerService } from './run-logger.service';

function attachScreenshotUrls(results: Partial<Record<DeviceType, InternalTestResult>>) {
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

function attachGifUrls(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  results: Partial<Record<DeviceType, InternalTestResult>>,
) {
  return Effect.gen(function* () {
    for (const [deviceType, result] of Object.entries(results) as [
      DeviceType,
      InternalTestResult,
    ][]) {
      if (!result) {
        continue;
      }

      yield* Effect.tryPromise({
        try: () => {
          return gifGenerator.generateGif(runID, deviceType);
        },
        catch: (err: unknown) => {
          return err;
        },
      }).pipe(
        Effect.tap(() => {
          return Effect.sync(() => {
            result.gifUrl = `/api/screenshots/${runID}/${deviceType}/${gifGenerator.ANIMATED_GIF_FILENAME}`;
          });
        }),
        Effect.catchAll((err: unknown) => {
          return runLoggerService.warn(
            runID,
            'media',
            `Failed to generate GIF for ${deviceType}: ${String(err)}`,
          );
        }),
      );
    }
  });
}

function cleanupImages(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  results: Partial<Record<DeviceType, InternalTestResult>>,
) {
  return Effect.gen(function* () {
    for (const result of Object.values(results)) {
      if (!result) {
        continue;
      }

      const paths = result.screenshotPaths;

      result.screenshotPaths = undefined;

      if (!paths || paths.length <= 1) {
        continue;
      }

      for (let i = 0; i < paths.length - 1; i++) {
        yield* Effect.try({
          try: () => {
            return fs.unlinkSync(paths[i]);
          },
          catch: (err) => {
            return err;
          },
        }).pipe(
          Effect.catchAll((err) => {
            return runLoggerService.warn(
              runID,
              'media',
              `Failed to delete screenshot: ${String(err)}`,
            );
          }),
        );
      }
    }
  });
}

export { attachScreenshotUrls, attachGifUrls, cleanupImages };

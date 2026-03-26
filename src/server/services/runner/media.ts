import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect } from 'effect';
import type { DeviceType } from '../../../shared/types';
import * as gifGenerator from '../../lib/gif-generator';
import type { InternalTestResult } from '../../types';

function attachScreenshotUrls(results: Partial<Record<DeviceType, InternalTestResult>>) {
  return Effect.sync(() => {
    const screenshotsBase = path.resolve('src/server/screenshots');

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

function attachGifUrls(runID: string, results: Partial<Record<DeviceType, InternalTestResult>>) {
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
          return Effect.sync(() => {
            console.warn('[runner] Failed to generate GIF:', err);
          });
        }),
      );
    }
  });
}

function cleanupImages(results: Partial<Record<DeviceType, InternalTestResult>>) {
  return Effect.sync(() => {
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
        try {
          fs.unlinkSync(paths[i]);
        } catch (err) {
          console.warn('[runner] Failed to delete failure screenshot:', err);
        }
      }
    }
  });
}

export { attachScreenshotUrls, attachGifUrls, cleanupImages };

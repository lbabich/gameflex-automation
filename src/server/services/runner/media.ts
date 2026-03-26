import * as fs from 'node:fs';
import * as path from 'node:path';
import { Effect } from 'effect';
import * as gifGenerator from '../../lib/gif-generator';
import * as libTypes from '../../lib/types';
import type { TestResult } from './types';

function attachScreenshotUrls(results: TestResult[]) {
  return Effect.sync(() => {
    const screenshotsBase = path.resolve('src/server/screenshots');

    for (const result of results) {
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

function attachGifUrls(runID: string, results: TestResult[]) {
  return Effect.gen(function* () {
    const deviceTypes = [
      ...new Set(
        results.map((result: TestResult) => {
          return /mobile/i.test(result.project)
            ? libTypes.DEVICE_TYPE.MOBILE
            : libTypes.DEVICE_TYPE.DESKTOP;
        }),
      ),
    ];

    const gifUrls = new Map<libTypes.DeviceType, string>();

    for (const deviceType of deviceTypes) {
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
            gifUrls.set(
              deviceType,
              `/api/screenshots/${runID}/${deviceType}/${gifGenerator.ANIMATED_GIF_FILENAME}`,
            );
          });
        }),
        Effect.catchAll((err: unknown) => {
          return Effect.sync(() => {
            console.warn('[runner] Failed to generate GIF:', err);
          });
        }),
      );
    }

    for (const result of results) {
      const deviceType = /mobile/i.test(result.project)
        ? libTypes.DEVICE_TYPE.MOBILE
        : libTypes.DEVICE_TYPE.DESKTOP;

      const url = gifUrls.get(deviceType);

      if (url !== undefined) {
        result.gifUrl = url;
      }
    }
  });
}

function cleanupImages(results: TestResult[]) {
  return Effect.sync(() => {
    for (const result of results) {
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

import { Effect, Layer } from 'effect';
import type { RunStatus } from '../../shared/types';
import { FileService } from '../file.service';
import type { ChildProcessOutput, InternalRunRecord } from '../types';
import { attachGifUrls, attachScreenshotUrls, cleanupImages } from './media';
import { parseSpinOutput } from './output-parser';
import { RunLoggerService } from './run-logger.service';

export class RunFinalizationService extends Effect.Tag('RunFinalizationService')<
  RunFinalizationService,
  {
    finalize: (
      record: InternalRunRecord,
      code: number,
      outputFilePath: string,
    ) => Effect.Effect<InternalRunRecord>;
  }
>() {}

export const NodeRunFinalizationService = Layer.effect(
  RunFinalizationService,
  Effect.gen(function* () {
    const fileService = yield* FileService;
    const runLoggerService = yield* RunLoggerService;

    return {
      finalize: (record: InternalRunRecord, code: number, outputFilePath: string) => {
        return Effect.gen(function* () {
          const { runID } = record;

          const outputJson = yield* fileService.read(outputFilePath).pipe(
            Effect.orElse(() => {
              return Effect.succeed('');
            }),
          );

          const finishedAt = new Date().toISOString();
          const durationMs = new Date(finishedAt).getTime() - new Date(record.startedAt).getTime();

          let updated: InternalRunRecord = {
            ...record,
            rawOutput: outputJson,
            finishedAt,
            durationMs,
          };

          if (record.status !== 'cancelled') {
            const parsed = yield* parseOutput(runLoggerService, runID, outputJson, code);

            updated = { ...updated, ...parsed };
          }

          yield* attachScreenshotUrls(updated.results);
          yield* attachGifUrls(runLoggerService, runID, updated.results);
          yield* cleanupImages(runLoggerService, runID, updated.results);

          return updated;
        });
      },
    };
  }),
);

function parseOutput(
  runLoggerService: RunLoggerService['Type'],
  runID: string,
  outputJson: string,
  code: number,
) {
  return Effect.gen(function* () {
    yield* runLoggerService.log(runID, 'finalize', `parsing output for run ${runID}`);

    const emptyResult: ChildProcessOutput = {
      results: {},
      errors: [],
    };

    const parsed = yield* parseSpinOutput(outputJson).pipe(
      Effect.tapError((error) => {
        return runLoggerService.error(runID, 'finalize', 'Failed to parse spin output', error);
      }),
      Effect.tapError(() => {
        return runLoggerService.error(
          runID,
          'finalize',
          `output snippet: ${outputJson.slice(0, 200)}`,
        );
      }),
      Effect.orElse(() => {
        return Effect.succeed(emptyResult);
      }),
    );

    yield* runLoggerService.log(
      runID,
      'finalize',
      `${Object.keys(parsed.results).length} result(s), ${parsed.errors.length} error(s)`,
    );

    const status: RunStatus = code === 0 ? 'completed' : 'error';

    return {
      results: parsed.results,
      playwrightErrors: parsed.errors,
      status,
    };
  });
}

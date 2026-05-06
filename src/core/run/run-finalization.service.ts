import { Effect, Layer, type ParseResult } from 'effect';
import type { RunStatus } from '../../shared/types';
import { FileService } from '../file-service/service';
import type { ChildProcessOutput, InternalRunRecord } from '../types';
import { media } from './output/media';
import { outputParser } from './output/output-parser';
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
            const parsed = yield* parseOutput(runLoggerService, runID, outputJson, code).pipe(
              Effect.catchTag('ParseError', (error) => {
                return Effect.succeed({
                  results: {} as ChildProcessOutput['results'],
                  playwrightErrors: [] as string[],
                  status: 'error' as RunStatus,
                  parseError: error.message,
                });
              }),
            );

            updated = { ...updated, ...parsed };
          }

          yield* media.attachScreenshotUrls(updated.results);

          const mediaResult = yield* media.runMediaPipeline(
            runLoggerService,
            runID,
            updated.results,
          );

          return { ...updated, mediaResult };
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
): Effect.Effect<
  { results: ChildProcessOutput['results']; playwrightErrors: string[]; status: RunStatus },
  ParseResult.ParseError
> {
  return Effect.gen(function* () {
    yield* runLoggerService.log(runID, 'finalize', `parsing output for run ${runID}`);

    const parsed = yield* outputParser.parseSpinOutput(outputJson).pipe(
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

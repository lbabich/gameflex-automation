import { execSync, spawn } from 'node:child_process';
import { Effect, Layer } from 'effect';
import type { GameEntry, RunHints } from '../../shared/types';
import { ProcessError } from '../errors';
import { RunLoggerService } from './run-logger.service';

export type RunArgs = {
  runID: string;
  games: GameEntry[];
  deviceTypes: string[];
  outputFilePath: string;
  steps?: string[];
  hints?: RunHints;
};

const DEFAULT_STEPS = ['gameLoad', 'spinCycle'];

export class ProcessExecutorService extends Effect.Tag('ProcessExecutorService')<
  ProcessExecutorService,
  {
    execute: (args: RunArgs) => Effect.Effect<{ code: number }, ProcessError>;
  }
>() {}

const GSA_LOG_PREFIX = '[gsa:log] ';

export const NodeProcessExecutorService = Layer.effect(
  ProcessExecutorService,
  Effect.gen(function* () {
    const runLoggerService = yield* RunLoggerService;

    return {
      execute: (args: RunArgs) => {
        return Effect.async<{ code: number }, ProcessError>((resume) => {
          const cmd = buildCommand(args);
          const stdoutChunks: Buffer[] = [];
          let stderrBuffer = '';

          const proc = spawn(cmd, { stdio: ['ignore', 'pipe', 'pipe'], shell: true });

          proc.stdout?.on('data', (chunk: Buffer) => {
            return stdoutChunks.push(chunk);
          });

          proc.stderr?.on('data', (chunk: Buffer) => {
            stderrBuffer += chunk.toString('utf-8');

            const lines = stderrBuffer.split('\n');

            stderrBuffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.trim()) {
                continue;
              }

              if (line.startsWith(GSA_LOG_PREFIX)) {
                const stripped = line.slice(GSA_LOG_PREFIX.length);

                Effect.runSync(runLoggerService.appendRaw(args.runID, stripped));
              } else {
                console.log(`[playwright] ${line}`);
              }
            }
          });

          proc.on('close', (code: number | null) => {
            if (stderrBuffer.trim()) {
              if (stderrBuffer.startsWith(GSA_LOG_PREFIX)) {
                Effect.runSync(
                  runLoggerService.appendRaw(args.runID, stderrBuffer.slice(GSA_LOG_PREFIX.length)),
                );
              } else {
                console.log(`[playwright] ${stderrBuffer}`);
              }
            }

            resume(Effect.succeed({ code: code ?? 1 }));
          });

          proc.on('error', (err: Error) => {
            console.error('[runner] Spawn error:', err);
            resume(Effect.fail(new ProcessError({ message: err.message })));
          });

          return Effect.sync(() => {
            if (proc.pid) {
              try {
                execSync(`taskkill /F /T /PID ${proc.pid}`);
              } catch (err) {
                console.error('[runner] taskkill failed, falling back to proc.kill():', err);

                try {
                  proc.kill();
                } catch (killError) {
                  console.error('[runner] Failed to kill process:', killError);
                }
              }
            }
          });
        });
      },
    };
  }),
);

function buildCommand(args: RunArgs): string {
  const { runID, games, deviceTypes, outputFilePath, steps = DEFAULT_STEPS, hints } = args;

  const gamesArg = Buffer.from(JSON.stringify(games)).toString('base64');
  const devices = deviceTypes.join(',');
  const stepsArg = steps.join(',');

  let cmd = `npx tsx src/core/game-session-automation/runner.ts --runID=${runID} --games=${gamesArg} --deviceTypes=${devices} --steps=${stepsArg} --outputFile=${outputFilePath}`;

  if (hints?.spinCycle || hints?.gameClose) {
    cmd += ` --hints=${Buffer.from(JSON.stringify(hints)).toString('base64')}`;
  }

  return cmd;
}

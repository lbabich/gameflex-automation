import { execSync, spawn } from 'node:child_process';
import { Effect, Layer } from 'effect';
import type { GameEntry, RunHints } from '../../shared/types';

const DEFAULT_STEPS = ['gameLoad', 'spinCycle'];

export class ProcessExecutorService extends Effect.Tag('ProcessExecutorService')<
  ProcessExecutorService,
  {
    execute: (cmd: string) => Effect.Effect<{ code: number; stdout: string }>;
  }
>() {}

export const NodeProcessExecutorService = Layer.succeed(ProcessExecutorService, {
  execute: (cmd: string) => {
    return Effect.async<{ code: number; stdout: string }, never>(
      (resume: (effect: Effect.Effect<{ code: number; stdout: string }>) => void) => {
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
            if (line.trim()) {
              console.log(`[playwright] ${line}`);
            }
          }
        });

        proc.on('close', (code: number | null) => {
          if (stderrBuffer.trim()) {
            console.log(`[playwright] ${stderrBuffer}`);
          }

          resume(
            Effect.succeed({
              code: code ?? 1,
              stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
            }),
          );
        });

        proc.on('error', (err: Error) => {
          console.error('[runner] Spawn error:', err);
          resume(Effect.succeed({ code: 1, stdout: err.message }));
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
      },
    );
  },
});

export function buildCommand(
  runID: string,
  games: GameEntry[],
  deviceTypes: string[],
  outputFilePath: string,
  steps: string[] = DEFAULT_STEPS,
  hints?: RunHints,
) {
  const gamesArg = Buffer.from(JSON.stringify(games)).toString('base64');
  const devices = deviceTypes.join(',');
  const stepsArg = steps.join(',');

  let cmd = `npx tsx src/core/game-session-automation/runner.ts --runID=${runID} --games=${gamesArg} --deviceTypes=${devices} --steps=${stepsArg} --outputFile=${outputFilePath}`;

  if (hints && (hints.spinCycle || hints.gameClose)) {
    cmd += ` --hints=${Buffer.from(JSON.stringify(hints)).toString('base64')}`;
  }

  return cmd;
}

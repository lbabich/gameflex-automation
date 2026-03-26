import { execSync, spawn } from 'node:child_process';
import { Effect } from 'effect';

function spawnProcess(cmd: string) {
  return Effect.async<{ code: number; stdout: string }, never>(
    (resume: (effect: Effect.Effect<{ code: number; stdout: string }>) => void) => {
      const chunks: Buffer[] = [];
      let stderrBuf = '';

      const proc = spawn(cmd, { stdio: ['ignore', 'pipe', 'pipe'], shell: true });

      proc.stdout?.on('data', (chunk: Buffer) => {
        return chunks.push(chunk);
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf-8');

        const lines = stderrBuf.split('\n');

        stderrBuf = lines.pop() ?? '';

        for (const line of lines) {
          if (line.trim()) {
            console.log(`[playwright] ${line}`);
          }
        }
      });

      proc.on('close', (code: number | null) => {
        if (stderrBuf.trim()) {
          console.log(`[playwright] ${stderrBuf}`);
        }

        resume(
          Effect.succeed({ code: code ?? 1, stdout: Buffer.concat(chunks).toString('utf-8') }),
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
            } catch (killErr) {
              console.error('[runner] Failed to kill process:', killErr);
            }
          }
        }
      });
    },
  );
}

export { spawnProcess };

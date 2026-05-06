import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import type { DeviceType, GameEntry, RunHints } from '../../shared/types';
import { cache } from '../step-cache/cache';
import { disk } from '../step-cache/disk';
import type { ChildProcessOutput, InternalTestResult, Viewport } from '../types';
import type { GameSessionContext, GameSessionOptions } from './game-session';
import { gameSession } from './game-session';
import { stepRegistry } from './steps/registry';
import { claudeVisionAnalyzer } from './vision-analyzer';

dotenv.config();

const VIEWPORT: Viewport = { width: 1280, height: 720 };

async function main() {
  const { runID, selectedGames, deviceTypes, steps, hints, outputFile } = parseArgs();
  const diskStore = disk.createDiskStore();
  const stepCache = cache.createStepCache(diskStore);

  const resolvedSteps = stepRegistry.resolveSteps(steps);

  const browser = await chromium.launch({ headless: false });

  const results: Partial<Record<DeviceType, InternalTestResult>> = {};
  const errors: string[] = [];

  try {
    for (const game of selectedGames) {
      for (const deviceType of deviceTypes) {
        const context: GameSessionContext = { browser, game, deviceType, viewport: VIEWPORT };
        const options: GameSessionOptions = {
          runID,
          steps: resolvedSteps,
          hints,
          cache: stepCache,
        };

        const result = await gameSession.run(context, options, claudeVisionAnalyzer);

        results[deviceType] = {
          ...result,
          logs: [...(results[deviceType]?.logs ?? []), ...result.logs],
        };
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  } finally {
    try {
      await browser.close();
    } catch {
      // browser may have already crashed — don't let this swallow the results
    }
  }

  const output: ChildProcessOutput = { results, errors };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(output));
}

function parseArgs() {
  const args = process.argv.slice(2);

  let runID = '';
  let selectedGames: GameEntry[] = [];
  let deviceTypes: DeviceType[] = [];
  let steps = stepRegistry.DEFAULT_STEPS;
  let hints: RunHints = {};
  let outputFile = '';

  for (const arg of args) {
    if (arg.startsWith('--runID=')) {
      runID = arg.slice('--runID='.length);
    } else if (arg.startsWith('--games=')) {
      selectedGames = JSON.parse(
        Buffer.from(arg.slice('--games='.length), 'base64').toString('utf8'),
      ) as GameEntry[];
    } else if (arg.startsWith('--deviceTypes=')) {
      deviceTypes = arg.slice('--deviceTypes='.length).split(',').filter(Boolean) as DeviceType[];
    } else if (arg.startsWith('--steps=')) {
      steps = arg.slice('--steps='.length).split(',').filter(Boolean);
    } else if (arg.startsWith('--hints=')) {
      hints = JSON.parse(
        Buffer.from(arg.slice('--hints='.length), 'base64').toString('utf8'),
      ) as RunHints;
    } else if (arg.startsWith('--outputFile=')) {
      outputFile = arg.slice('--outputFile='.length);
    }
  }

  return { runID, selectedGames, deviceTypes, steps, hints, outputFile };
}

main().catch((err: unknown) => {
  console.error('[test-runner] Fatal error:', err);
  process.exit(1);
});

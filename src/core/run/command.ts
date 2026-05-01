import type { GameEntry, RunHints } from '../../shared/types';

const DEFAULT_STEPS = ['gameLoad', 'spinCycle'];

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

  let cmd = `npx tsx src/core/game-session-automation/index.ts --runID=${runID} --games=${gamesArg} --deviceTypes=${devices} --steps=${stepsArg} --outputFile=${outputFilePath}`;

  if (hints && (hints.spinCycle || hints.gameClose)) {
    cmd += ` --hints=${Buffer.from(JSON.stringify(hints)).toString('base64')}`;
  }

  return cmd;
}

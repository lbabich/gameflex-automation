import type { RunHints } from '../../shared/types';

const DEFAULT_STEPS = ['gameLoad', 'spinCycle'];

function buildSpinCommand(
  runID: string,
  gameIDs: string[],
  deviceTypes: string[],
  steps: string[] = DEFAULT_STEPS,
  hints?: RunHints,
) {
  const ids = gameIDs.join(',');
  const devices = deviceTypes.join(',');
  const stepsArg = steps.join(',');

  let cmd = `npx tsx src/core/game-session-automation/index.ts --runID=${runID} --gameIDs=${ids} --deviceTypes=${devices} --steps=${stepsArg}`;

  if (hints && (hints.spinCycle || hints.gameClose)) {
    cmd += ` --hints=${Buffer.from(JSON.stringify(hints)).toString('base64')}`;
  }

  return cmd;
}

export { buildSpinCommand };

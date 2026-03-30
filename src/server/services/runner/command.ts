const DEFAULT_STEPS = ['gameLoad', 'gameReady', 'spinCycle'];

function buildSpinCommand(
  runID: string,
  gameIDs: string[],
  deviceTypes: string[],
  playmode: string,
  steps: string[] = DEFAULT_STEPS,
) {
  const ids = gameIDs.join(',');
  const devices = deviceTypes.join(',');
  const stepsArg = steps.join(',');

  return `npx tsx src/server/scripts/test-runner.ts --runID=${runID} --gameIDs=${ids} --deviceTypes=${devices} --playmode=${playmode} --steps=${stepsArg}`;
}

export { buildSpinCommand };

function buildSpinCommand(
  runID: string,
  gameIDs: string[],
  deviceTypes: string[],
  playmode: string,
) {
  const ids = gameIDs.join(',');
  const devices = deviceTypes.join(',');

  return `npx tsx src/scripts/spin.ts --runID=${runID} --gameIDs=${ids} --deviceTypes=${devices} --playmode=${playmode}`;
}

export { buildSpinCommand };

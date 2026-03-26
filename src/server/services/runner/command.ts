function buildSpinCommand(runID: string, gameIDs: string[], deviceTypes?: string[]) {
  const ids = gameIDs.join(',');

  const deviceFlag = deviceTypes?.length ? ` --deviceTypes=${deviceTypes.join(',')}` : '';

  return `npx tsx src/scripts/spin.ts --runID=${runID} --gameIDs=${ids}${deviceFlag}`;
}

export { buildSpinCommand };

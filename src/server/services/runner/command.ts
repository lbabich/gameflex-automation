function buildSpinCommand(gameIDs: string[], deviceTypes?: string[]) {
  const ids = gameIDs.join(',');

  const deviceFlag = deviceTypes?.length ? ` --deviceTypes=${deviceTypes.join(',')}` : '';

  return `npx tsx src/scripts/spin.ts --gameIDs=${ids}${deviceFlag}`;
}

export { buildSpinCommand };

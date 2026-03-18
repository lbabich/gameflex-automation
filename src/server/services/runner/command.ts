export function buildPlaywrightCommand(names: string[], projects?: string[]): string {
  const grepPattern = names
    .map((n) => {
      return `spin: ${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    })
    .join('|');

  const quotedPattern = `"${grepPattern.replace(/"/g, '\\"')}"`;

  const projectFlags = projects?.length
    ? projects
        .map((p) => {
          return `--project "${p}"`;
        })
        .join(' ')
    : '';

  return `npx playwright test --reporter=json --grep ${quotedPattern}${projectFlags ? ` ${projectFlags}` : ''}`;
}

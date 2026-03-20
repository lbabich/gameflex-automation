export function buildPlaywrightCommand(names: string[], projects?: string[]) {
  const grepPattern = names
    .map((name) => {
      return `spin: ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    })
    .join('|');

  const quotedPattern = `"${grepPattern.replace(/"/g, '\\"')}"`;

  const projectFlags = projects?.length
    ? projects
        .map((project) => {
          return `--project "${project}"`;
        })
        .join(' ')
    : '';

  return `npx playwright test --reporter=json --grep ${quotedPattern}${projectFlags ? ` ${projectFlags}` : ''}`;
}

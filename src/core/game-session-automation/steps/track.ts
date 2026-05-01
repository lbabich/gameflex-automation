import type { TestStep } from '../../../shared/types';

export async function track<T>(steps: TestStep[], title: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const planTitle = title.replace(' (cached)', '');

  const idx = steps.findIndex((s) => {
    return s.title === planTitle;
  });

  const optional = idx >= 0 ? steps[idx].optional : undefined;

  try {
    const result = await fn();

    const entry: TestStep = { title, duration: Date.now() - start, status: 'passed', optional };

    if (idx >= 0) {
      steps[idx] = entry;
    } else {
      steps.push(entry);
    }

    return result;
  } catch (err) {
    const entry: TestStep = {
      title,
      duration: Date.now() - start,
      status: optional ? 'warning' : 'failed',
      error: err instanceof Error ? err.message : String(err),
      optional,
    };

    if (idx >= 0) {
      steps[idx] = entry;
    } else {
      steps.push(entry);
    }

    if (!optional) {
      throw err;
    }
  }
}

import type { TestStep } from '../../../shared/types';

export class StepFailure extends Error {
  constructor(public readonly step: TestStep) {
    super(step.error ?? step.title);
    this.name = 'StepFailure';
  }
}

export async function track(
  title: string,
  fn: () => Promise<unknown>,
  optional?: boolean,
): Promise<TestStep> {
  const start = Date.now();

  try {
    await fn();

    return { title, duration: Date.now() - start, status: 'passed', optional };
  } catch (err) {
    const step: TestStep = {
      title,
      duration: Date.now() - start,
      status: optional ? 'warning' : 'failed',
      error: err instanceof Error ? err.message : String(err),
      optional,
    };

    if (!optional) {
      throw new StepFailure(step);
    }

    return step;
  }
}

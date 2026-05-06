import type { TestStep } from '../../../shared/types';
import { audioToggle } from './audio-toggle';
import { gameClose } from './game-close';
import { gameLoad } from './game-load';
import { spinCycle } from './spin-cycle';
import type { FullStepContext, Step } from './types';

export const DEFAULT_STEPS = ['gameLoad', 'spinCycle', 'audioToggle', 'gameClose'];

const STEP_REGISTRY: Record<string, Step<FullStepContext>> = {
  gameLoad,
  spinCycle,
  audioToggle,
  gameClose,
};

function resolveSteps(names: string[]): Step<FullStepContext>[] {
  return names.map((name) => {
    const step = STEP_REGISTRY[name];

    if (!step) {
      throw new Error(`Unknown step '${name}'`);
    }

    return step;
  });
}

function planSteps(steps: Step<FullStepContext>[]): TestStep[] {
  return steps.flatMap((step) => {
    return step.plan.map((descriptor) => {
      return {
        title: descriptor.title,
        duration: 0,
        status: 'skipped' as const,
        optional: descriptor.optional,
      };
    });
  });
}

function mergeSteps(planned: TestStep[], actual: TestStep[]): TestStep[] {
  const result = [...planned];

  for (const step of actual) {
    const planTitle = step.title.replace(' (cached)', '');
    const idx = result.findIndex((s) => {
      return s.title === planTitle;
    });

    if (idx >= 0) {
      result[idx] = step;
    } else {
      result.push(step);
    }
  }

  return result;
}

export const stepRegistry = { DEFAULT_STEPS, resolveSteps, planSteps, mergeSteps };

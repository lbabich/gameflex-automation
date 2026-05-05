import { Layer } from 'effect';
import { NodeProcessExecutorService } from './process-executor.service';
import { NodeRunFinalizationService } from './run-finalization.service';
import { NodeRunLoggerService } from './run-logger.service';
import { NodeRunStateManager } from './run-state.manager';
import { NodeRunnerService, RunnerService } from './runner.service';

const RunLoggerLayer = Layer.provide(NodeRunLoggerService, NodeRunStateManager);
const RunFinalizationLayer = Layer.provide(NodeRunFinalizationService, RunLoggerLayer);

export const RunDomainLayer = Layer.provide(
  NodeRunnerService,
  Layer.mergeAll(
    NodeRunStateManager,
    RunLoggerLayer,
    NodeProcessExecutorService,
    RunFinalizationLayer,
  ),
);

export { RunnerService };

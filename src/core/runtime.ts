import { Layer, ManagedRuntime } from 'effect';
import { NodeFileService } from './file-service/service';
import { NodeGamesService } from './game-catalog/game-catalog.module';
import {
  NodeProcessExecutorService,
  NodeRunFinalizationService,
  NodeRunLoggerService,
  NodeRunnerService,
  NodeRunStateService,
} from './run/run.module';
import { NodeStepCacheService } from './step-cache/service';

const ProvidedRunLoggerService = Layer.provide(NodeRunLoggerService, NodeRunStateService);
const ProvidedNodeGamesService = Layer.provide(NodeGamesService, NodeStepCacheService);
const ProvidedNodeRunFinalizationService = Layer.provide(
  NodeRunFinalizationService,
  Layer.mergeAll(NodeFileService, ProvidedRunLoggerService),
);
const ProvidedNodeRunnerService = Layer.provide(
  NodeRunnerService,
  Layer.mergeAll(
    NodeRunStateService,
    NodeFileService,
    ProvidedNodeGamesService,
    NodeProcessExecutorService,
    ProvidedRunLoggerService,
    ProvidedNodeRunFinalizationService,
  ),
);

const AppLayer = Layer.mergeAll(
  NodeRunStateService,
  NodeFileService,
  NodeStepCacheService,
  ProvidedNodeGamesService,
  ProvidedRunLoggerService,
  ProvidedNodeRunFinalizationService,
  ProvidedNodeRunnerService,
);

export const appRuntime = ManagedRuntime.make(AppLayer);

export type AppRuntime = typeof appRuntime;

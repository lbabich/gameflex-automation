import { Layer, ManagedRuntime } from 'effect';
import { NodeFileService } from './file.service';
import { NodeGamesService } from './game-catalog/game-catalog.module';
import {
  NodeProcessExecutorService,
  NodeRunLoggerService,
  NodeRunnerService,
  NodeRunStateService,
} from './run/run.module';
import { NodeStepCacheService } from './step-cache.service';

const ProvidedRunLoggerService = Layer.provide(NodeRunLoggerService, NodeRunStateService);
const ProvidedNodeGamesService = Layer.provide(NodeGamesService, NodeStepCacheService);
const ProvidedNodeRunnerService = Layer.provide(
  NodeRunnerService,
  Layer.mergeAll(
    NodeRunStateService,
    NodeFileService,
    ProvidedNodeGamesService,
    NodeProcessExecutorService,
    ProvidedRunLoggerService,
  ),
);

const AppLayer = Layer.mergeAll(
  NodeRunStateService,
  NodeFileService,
  NodeStepCacheService,
  ProvidedNodeGamesService,
  ProvidedRunLoggerService,
  ProvidedNodeRunnerService,
);

export const appRuntime = ManagedRuntime.make(AppLayer);

export type AppRuntime = typeof appRuntime;

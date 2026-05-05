import { Layer, ManagedRuntime } from 'effect';
import { NodeFileService } from './file-service/service';
import { NodeGamesService } from './game-catalog/game-catalog.module';
import { RunDomainLayer } from './run/run.module';
import { NodeStepCacheService } from './step-cache/service';

const ProvidedNodeGamesService = Layer.provide(NodeGamesService, NodeStepCacheService);

const ProvidedRunDomainLayer = Layer.provide(
  RunDomainLayer,
  Layer.mergeAll(NodeFileService, ProvidedNodeGamesService),
);

const AppLayer = Layer.mergeAll(
  NodeFileService,
  NodeStepCacheService,
  ProvidedNodeGamesService,
  ProvidedRunDomainLayer,
);

export const appRuntime = ManagedRuntime.make(AppLayer);

export type AppRuntime = typeof appRuntime;

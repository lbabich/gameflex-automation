import { Layer, ManagedRuntime } from 'effect';
import { NodeConfigService } from './services/config';
import { NodeFileService } from './services/file';
import { NodeGamesService } from './services/games';
import { NodeRunnerService } from './services/runner';

const AppLayer = Layer.mergeAll(
  NodeFileService,
  NodeConfigService,
  NodeGamesService,
  Layer.provide(NodeRunnerService, NodeFileService),
);

export const appRuntime = ManagedRuntime.make(AppLayer);

export type AppRuntime = typeof appRuntime;

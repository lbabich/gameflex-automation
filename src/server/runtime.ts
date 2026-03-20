import { Layer, ManagedRuntime } from 'effect';
import { NodeConfigService } from './services/config.service';
import { NodeFileService } from './services/file.service';
import { NodeGamesService } from './services/games.service';
import { NodeRunnerService } from './services/runner/runner.service';

const AppLayer = Layer.mergeAll(
  NodeFileService,
  NodeConfigService,
  NodeGamesService,
  Layer.provide(NodeRunnerService, NodeFileService),
);

export const appRuntime = ManagedRuntime.make(AppLayer);

export type AppRuntime = typeof appRuntime;

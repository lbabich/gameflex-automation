import { Layer, ManagedRuntime } from 'effect';
import { NodeFileService } from './services/file.service';
import { NodeGamesService } from './services/games.service';
import { NodeRunnerService } from './services/runner/runner.service';

const AppLayer = Layer.mergeAll(
  NodeFileService,
  NodeGamesService,
  Layer.provide(NodeRunnerService, Layer.mergeAll(NodeFileService, NodeGamesService)),
);

export const appRuntime = ManagedRuntime.make(AppLayer);

export type AppRuntime = typeof appRuntime;

import { Layer, ManagedRuntime } from 'effect';
import { NodeFileService } from './services/file.service';
import { NodeGamesService } from './services/games.service';
import { NodeRunnerService } from './services/runner/runner.service';
import { NodeRunLoggerService } from './services/runner/run-logger.service';
import { NodeRunStateService } from './services/runner/run-state.service';

const AppLayer = Layer.mergeAll(
	NodeFileService,
	NodeGamesService,
	NodeRunStateService,
	Layer.provide(NodeRunLoggerService, Layer.mergeAll(NodeRunStateService)),
    Layer.provide(NodeRunnerService, Layer.mergeAll(NodeRunStateService, NodeFileService, NodeGamesService, NodeRunLoggerService)),
);

export const appRuntime = ManagedRuntime.make(AppLayer);

export type AppRuntime = typeof appRuntime;

import { useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AddGameModal, EditGameModal, GameSelector, useGameCatalog, useGames } from './game-catalog';
import {
  DiscoveryHints,
  GameActionBar,
  ResultsPanel,
  RunHistory,
  useClearGameRuns,
  useRecentRuns,
  useRun,
  useRunConfiguration,
} from './run';
import { QUERY_KEY } from './shared/queryKeys';
import type { GameEntry } from '@shared/types';

export default function App() {
  const [selectedGameID, setSelectedGameID] = useState<string | null>(null);
  const [addGameOpen, setAddGameOpen] = useState(false);
  const [editGame, setEditGame] = useState<GameEntry | null>(null);
  const [viewRunID, setViewRunID] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: games, isLoading: gamesLoading } = useGames();
  const { data: run, isLoading: runLoading } = useRun(viewRunID);
  const { data: recentRuns } = useRecentRuns();
  const clearGameRunsMutation = useClearGameRuns();
  const { reorder } = useGameCatalog();
  const runConfig = useRunConfiguration(selectedGameID);

  const gameStatuses = useMemo(() => {
    const result: Record<string, { isRunning: boolean }> = {};

    for (const game of games ?? []) {
      const gameRuns = (recentRuns ?? []).filter((r) => r.gameIDs.includes(game.id));

      result[game.id] = { isRunning: gameRuns.some((r) => r.status === 'running') };
    }

    return result;
  }, [games, recentRuns]);

  const selectedGame = selectedGameID !== null
    ? (games ?? []).find((g) => g.id === selectedGameID) ?? null
    : null;

  const selectedGameRuns = useMemo(
    () => (recentRuns ?? []).filter((r) => selectedGameID ? r.gameIDs.includes(selectedGameID) : true),
    [recentRuns, selectedGameID],
  );

  const selectedGameIsRunning = selectedGameID !== null
    ? (gameStatuses[selectedGameID]?.isRunning ?? false)
    : false;

  const selectedGameRunID = selectedGameID !== null
    ? ((recentRuns ?? []).find((r) => r.gameIDs.includes(selectedGameID) && r.status === 'running')?.runID ?? null)
    : null;

  function handleGameSelect(id: string) {
    setSelectedGameID(id);
    const found = (recentRuns ?? []).find((r) => r.gameIDs.includes(id));
    setViewRunID(found?.runID ?? null);
  }

  function handleRunSelect(runID: string) {
    const run = (recentRuns ?? []).find((r) => r.runID === runID);

    if (run?.gameIDs[0] && !selectedGameID) {
      setSelectedGameID(run.gameIDs[0]);
    }

    setViewRunID(runID);
  }

  function handleRunComplete(runID: string) {
    setViewRunID(runID);
    queryClient.invalidateQueries({ queryKey: QUERY_KEY.RUNS });
  }

  function handleClearRuns() {
    if (selectedGameID === null) return;

    clearGameRunsMutation.mutate(selectedGameID, {
      onSuccess: () => setViewRunID(null),
    });
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white border-r p-4 flex flex-col">
        <h1 className="text-lg font-bold mb-4">GameFlex Automation</h1>
        {gamesLoading ? (
          <div className="text-sm text-gray-400">Loading games...</div>
        ) : (
          <GameSelector
            games={games ?? []}
            selectedGameID={selectedGameID}
            gameStatuses={gameStatuses}
            onSelect={handleGameSelect}
            onEdit={setEditGame}
            onReorder={(ids) => reorder.mutate(ids)}
          />
        )}
        <div className="mt-auto pt-4 border-t flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setAddGameOpen(true)}
            className="w-full px-3 py-2 rounded text-sm font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
          >
            + Add Game
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        {selectedGame && (
          <GameActionBar
            game={selectedGame}
            isRunning={selectedGameIsRunning}
            runID={selectedGameRunID}
            runDevices={runConfig.runDevices}
            resetCacheDevices={runConfig.resetCacheDevices}
            onToggleRunDevice={runConfig.toggleRunDevice}
            onToggleResetDevice={runConfig.toggleResetDevice}
            hints={runConfig.hints}
            onRunComplete={handleRunComplete}
          />
        )}
        {selectedGame && (
          <DiscoveryHints
            spinCycleHint={runConfig.spinCycleHint}
            gameCloseHint={runConfig.gameCloseHint}
            audioToggleHint={runConfig.audioToggleHint}
            onSpinHintChange={runConfig.setSpinCycleHint}
            onCloseHintChange={runConfig.setGameCloseHint}
            onAudioToggleHintChange={runConfig.setAudioToggleHint}
          />
        )}
        {selectedGame ? (
          <div className="flex gap-4 items-start">
            <div className="flex-[2] min-w-0">
              {viewRunID !== null
                  ? <ResultsPanel key={viewRunID} run={run} isLoading={runLoading} />
                  : (
                      <div className="text-sm text-gray-400 text-center py-8">
                        Select a run to view results.
                      </div>
                  )
              }
            </div>
            <RunHistory
              runs={selectedGameRuns}
              selectedRunID={viewRunID}
              onSelect={handleRunSelect}
              onClear={handleClearRuns}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <Play className="w-12 h-12 text-gray-300" strokeWidth={1.5} />
            <p className="text-sm">Select a game to view its runs.</p>
          </div>
        )}
      </main>

      {addGameOpen && <AddGameModal onClose={() => setAddGameOpen(false)} />}
      {editGame && (
        <EditGameModal
          game={editGame}
          onClose={() => setEditGame(null)}
          onDelete={() => {
            if (selectedGameID === editGame.id) {
              setSelectedGameID(null);
            }
          }}
        />
      )}
    </div>
  );
}

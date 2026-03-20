import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AddGameModal } from './components/AddGameModal';
import { EditGameModal } from './components/EditGameModal';
import { GameActionBar } from './components/GameActionBar';
import { GameDeviceSettings } from './components/GameDeviceSettings';
import { GameSelector } from './components/GameSelector';
import { RecentRunsList } from './components/RecentRunsList';
import { ResultsPanel } from './components/ResultsPanel';
import { useGames } from './hooks/useGames';
import { useRecentRuns } from './hooks/useRecentRuns';
import { useRun } from './hooks/useRun';
import { QUERY_KEY } from './queryKeys';
import { DEVICE_TYPE } from './types';
import type { GameEntry } from './types';

export default function App() {
  const [selectedGameID, setSelectedGameID] = useState<string | null>(null);
  const [addGameOpen, setAddGameOpen] = useState(false);
  const [editGame, setEditGame] = useState<GameEntry | null>(null);
  const [viewRunID, setViewRunID] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: games, isLoading: gamesLoading } = useGames();
  const { data: run, isLoading: runLoading } = useRun(viewRunID);
  const { data: recentRuns } = useRecentRuns();
  const prevStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevStatusRef.current === 'running' && run?.status !== 'running') {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.RUNS });
    }

    prevStatusRef.current = run?.status;
  }, [run?.status, queryClient]);

  const gameStatuses = useMemo(() => {
    type DeviceStatus = 'passed' | 'failed' | 'error' | null;
    type Status = { isRunning: boolean; lastStatus: DeviceStatus; desktopLastStatus: DeviceStatus; mobileLastStatus: DeviceStatus };
    const result: Record<string, Status> = {};

    function deviceStatus(completedRuns: typeof recentRuns, project: string): DeviceStatus {
      for (const run of completedRuns ?? []) {
        if (run.status !== 'completed') continue;

        const testResult = run.results.find((r) => r.project === project && r.status !== 'skipped');

        if (testResult) {
          return (testResult.status === 'failed' || testResult.status === 'timedOut') ? 'failed' : 'passed';
        }
      }

      return null;
    }

    for (const game of games ?? []) {
      const gameRuns = (recentRuns ?? []).filter((r) => r.gameIDs.includes(game.id));
      const running = gameRuns.some((r) => r.status === 'running');
      const completedRuns = gameRuns.filter((r) => r.status !== 'running');
      const last = completedRuns[0];
      let lastStatus: DeviceStatus = null;

      if (last) {
        if (last.status === 'completed') {
          lastStatus = last.results.some((r) => r.status === 'failed' || r.status === 'timedOut') ? 'failed' : 'passed';
        } else {
          lastStatus = 'error';
        }
      }

      result[game.id] = {
        isRunning: running,
        lastStatus,
        desktopLastStatus: deviceStatus(completedRuns, DEVICE_TYPE.DESKTOP),
        mobileLastStatus: deviceStatus(completedRuns, DEVICE_TYPE.MOBILE),
      };
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
            onRunComplete={handleRunComplete}
          />
        )}
        {selectedGame && (
          <GameDeviceSettings
            game={selectedGame}
            isRunning={selectedGameIsRunning}
            desktopLastStatus={gameStatuses[selectedGame.id]?.desktopLastStatus ?? null}
            mobileLastStatus={gameStatuses[selectedGame.id]?.mobileLastStatus ?? null}
            onRunComplete={handleRunComplete}
          />
        )}
        {viewRunID !== null ? (
          <ResultsPanel run={run} isLoading={runLoading} />
        ) : (
          <RecentRunsList
            runs={selectedGameRuns}
            games={games ?? []}
            onSelect={handleRunSelect}
            emptyMessage={
              selectedGame
                ? `No runs yet for ${selectedGame.name}. Click Run Test to start.`
                : 'Select a game to view its runs.'
            }
          />
        )}
      </main>

      {addGameOpen && <AddGameModal onClose={() => setAddGameOpen(false)} />}
      {editGame && <EditGameModal game={editGame} onClose={() => setEditGame(null)} />}
    </div>
  );
}

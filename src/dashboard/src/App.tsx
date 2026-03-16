import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AddGameModal } from './components/AddGameModal';
import { GameActionBar } from './components/GameActionBar';
import { GameSelector } from './components/GameSelector';
import { RecentRunsList } from './components/RecentRunsList';
import { ResultsPanel } from './components/ResultsPanel';
import { useGames } from './hooks/useGames';
import { useRecentRuns } from './hooks/useRecentRuns';
import { useRun } from './hooks/useRun';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [addGameOpen, setAddGameOpen] = useState(false);
  const [viewRunId, setViewRunId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: games, isLoading: gamesLoading } = useGames();
  const { data: run, isLoading: runLoading } = useRun(viewRunId);
  const { data: recentRuns } = useRecentRuns();
  const { headless, toggle, isToggling } = useSettings();

  const prevStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevStatusRef.current === 'running' && run?.status !== 'running') {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    }

    prevStatusRef.current = run?.status;
  }, [run?.status, queryClient]);

  const gameStatuses = useMemo(() => {
    const result: Record<string, { isRunning: boolean; lastStatus: 'passed' | 'failed' | 'error' | null }> = {};

    for (const game of games ?? []) {
      const gameRuns = (recentRuns ?? []).filter((r) => r.gameIds.includes(game.gameId));
      const running = gameRuns.some((r) => r.status === 'running');
      const last = gameRuns.find((r) => r.status !== 'running');
      let lastStatus: 'passed' | 'failed' | 'error' | null = null;

      if (last) {
        if (last.status === 'completed') {
          lastStatus = last.results.some((r) => r.status === 'failed' || r.status === 'timedOut') ? 'failed' : 'passed';
        } else {
          lastStatus = 'error';
        }
      }

      result[game.gameId] = { isRunning: running, lastStatus };
    }

    return result;
  }, [games, recentRuns]);

  const selectedGame = selectedGameId !== null
    ? (games ?? []).find((g) => g.gameId === selectedGameId) ?? null
    : null;

  const selectedGameRuns = useMemo(
    () => (recentRuns ?? []).filter((r) => selectedGameId ? r.gameIds.includes(selectedGameId) : true),
    [recentRuns, selectedGameId],
  );

  const selectedGameIsRunning = selectedGameId !== null
    ? (gameStatuses[selectedGameId]?.isRunning ?? false)
    : false;

  const selectedGameRunId = selectedGameId !== null
    ? ((recentRuns ?? []).find((r) => r.gameIds.includes(selectedGameId) && r.status === 'running')?.runId ?? null)
    : null;

  function handleGameSelect(gameId: string) {
    setSelectedGameId(gameId);
    const found = (recentRuns ?? []).find((r) => r.gameIds.includes(gameId));
    setViewRunId(found?.runId ?? null);
  }

  function handleRunComplete(runId: string) {
    setViewRunId(runId);
    queryClient.invalidateQueries({ queryKey: ['runs'] });
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
            selectedGameId={selectedGameId}
            gameStatuses={gameStatuses}
            onSelect={handleGameSelect}
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
          <button
            type="button"
            onClick={toggle}
            disabled={isToggling}
            className="w-full flex items-center justify-between px-3 py-2 rounded text-sm bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <span className="text-gray-700">Headless</span>
            <span className={`text-xs font-semibold ${headless ? 'text-green-600' : 'text-orange-500'}`}>
              {headless ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        {selectedGame && (
          <GameActionBar
            game={selectedGame}
            isRunning={selectedGameIsRunning}
            runId={selectedGameRunId}
            onRunComplete={handleRunComplete}
          />
        )}
        {viewRunId !== null ? (
          <ResultsPanel run={run} isLoading={runLoading} />
        ) : (
          <RecentRunsList
            runs={selectedGameRuns}
            games={games ?? []}
            onSelect={setViewRunId}
            emptyMessage={
              selectedGame
                ? `No runs yet for ${selectedGame.name}. Click Run Test to start.`
                : 'Select a game to view its runs.'
            }
          />
        )}
      </main>

      {addGameOpen && <AddGameModal onClose={() => setAddGameOpen(false)} />}
    </div>
  );
}

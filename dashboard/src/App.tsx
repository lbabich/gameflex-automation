import { useState } from 'react';
import { AddGameModal } from './components/AddGameModal';
import { GameSelector } from './components/GameSelector';
import { ResultsPanel } from './components/ResultsPanel';
import { RunButton } from './components/RunButton';
import { useGames } from './hooks/useGames';
import { useRun } from './hooks/useRun';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [addGameOpen, setAddGameOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { data: games, isLoading: gamesLoading } = useGames();
  const { data: run, isLoading: runLoading } = useRun(activeRunId);
  const { headless, toggle, isToggling } = useSettings();

  const isRunning = run?.status === 'running';

  async function handleRun() {
    if (selectedGameIds.length === 0 || isRunning) return;

    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameIds: selectedGameIds }),
      });

      if (!res.ok) return;

      const data = (await res.json()) as { runId: string };

      setActiveRunId(data.runId);
    } catch {
      // ignore
    }
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
            selected={selectedGameIds}
            onChange={setSelectedGameIds}
          />
        )}
        <RunButton
          disabled={selectedGameIds.length === 0 || isRunning}
          running={isRunning}
          onClick={handleRun}
        />
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
        <ResultsPanel run={run} isLoading={runLoading} />
      </main>

      {addGameOpen && <AddGameModal onClose={() => setAddGameOpen(false)} />}
    </div>
  );
}

import { useState } from 'react';
import { GameSelector } from './components/GameSelector';
import { ResultsPanel } from './components/ResultsPanel';
import { RunButton } from './components/RunButton';
import { useGames } from './hooks/useGames';
import { useRun } from './hooks/useRun';

export default function App() {
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { data: games, isLoading: gamesLoading } = useGames();
  const { data: run, isLoading: runLoading } = useRun(activeRunId);

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
      </aside>

      <main className="flex-1 p-6">
        <ResultsPanel run={run} isLoading={runLoading} />
      </main>
    </div>
  );
}

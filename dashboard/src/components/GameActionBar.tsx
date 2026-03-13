import { useClearSteps } from '../hooks/useClearSteps';
import type { GameEntry } from '../types';

type Props = {
  game: GameEntry;
  isRunning: boolean;
  runId: string | null;
  onRunComplete: (runId: string) => void;
};

export function GameActionBar({ game, isRunning, runId, onRunComplete }: Props) {
  const clearSteps = useClearSteps();

  async function handleRun() {
    if (isRunning) return;

    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameIds: [game.gameId] }),
      });

      if (!res.ok) return;

      const data = (await res.json()) as { runId: string };

      onRunComplete(data.runId);
    } catch {
      // ignore
    }
  }

  async function handleCancel() {
    if (!runId) return;

    try {
      await fetch(`/api/runs/${runId}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
  }

  function handleReset() {
    clearSteps.mutate(game.gameId);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border rounded mb-4">
      <span className="font-semibold text-gray-800">{game.name}</span>
      <div className="flex gap-2">
        {isRunning ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={!runId}
            className="px-3 py-1.5 rounded text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRun}
            className="px-3 py-1.5 rounded text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Run Test
          </button>
        )}
        <button
          type="button"
          onClick={handleReset}
          disabled={isRunning || clearSteps.isPending}
          className="px-3 py-1.5 rounded text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Reset Cache
        </button>
      </div>
    </div>
  );
}

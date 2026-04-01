import { DEFAULT_STEPS, createRun, deleteRun } from '../api';
import { useClearSteps } from '../hooks/useClearSteps';
import type { GameEntry } from '@shared/types';

type Props = {
  game: GameEntry;
  isRunning: boolean;
  runID: string | null;
  spinCycleHint: string;
  gameCloseHint: string;
  audioToggleHint: string;
  onRunComplete: (runID: string) => void;
};

export function GameActionBar({
  game,
  isRunning,
  runID,
  spinCycleHint,
  gameCloseHint,
  audioToggleHint,
  onRunComplete,
}: Props) {
  const clearSteps = useClearSteps();

  async function handleRun() {
    if (isRunning) return;

    const hints = spinCycleHint || gameCloseHint || audioToggleHint
      ? { spinCycle: spinCycleHint || undefined, gameClose: gameCloseHint || undefined, audioToggle: audioToggleHint || undefined }
      : undefined;

    try {
      const data = await createRun({
        gameIDs: [game.id],
        deviceTypes: ['desktop', 'mobile'],
        steps: [...DEFAULT_STEPS],
        hints,
      });

      onRunComplete(data.runID);
    } catch {
      // ignore
    }
  }

  async function handleCancel() {
    if (!runID) return;

    try {
      await deleteRun(runID);
    } catch {
      // ignore
    }
  }

  function handleReset() {
    clearSteps.mutate(game.id);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border rounded mb-4">
      <span className="font-semibold text-gray-800">{game.name}</span>
      <div className="flex gap-2 items-center">
        {isRunning ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={!runID}
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
            Run Both
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

import { useState } from 'react';
import { useClearSteps } from '../hooks/useClearSteps';
import type { GameEntry, PlayMode } from '../types';

type Props = {
  game: GameEntry;
  isRunning: boolean;
  runID: string | null;
  playmode: PlayMode;
  onPlaymodeChange: (mode: PlayMode) => void;
  onRunComplete: (runID: string) => void;
};

function PlaymodeToggle({
  playmode,
  onChange,
}: {
  playmode: PlayMode;
  onChange: (mode: PlayMode) => void;
}) {
  const isReal = playmode === 'real';

  return (
    <div
      className="relative inline-flex h-7 rounded-full bg-gray-200 overflow-hidden cursor-pointer select-none"
      onClick={() => onChange(isReal ? 'demo' : 'real')}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1/2 bg-blue-600 transition-transform duration-200 ease-in-out ${isReal ? 'translate-x-full' : ''}`}
      />
      <span
        className={`relative z-10 w-14 flex items-center justify-center text-xs font-semibold transition-colors ${!isReal ? 'text-white' : 'text-gray-500'}`}
      >
        Demo
      </span>
      <span
        className={`relative z-10 w-14 flex items-center justify-center text-xs font-semibold transition-colors ${isReal ? 'text-white' : 'text-gray-500'}`}
      >
        Real
      </span>
    </div>
  );
}

export function GameActionBar({
  game,
  isRunning,
  runID,
  playmode,
  onPlaymodeChange,
  onRunComplete,
}: Props) {
  const clearSteps = useClearSteps();

  async function handleRun() {
    if (isRunning) return;

    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameIDs: [game.id],
          deviceTypes: ['desktop', 'mobile'],
          playmode,
        }),
      });

      if (!res.ok) return;

      const data = (await res.json()) as { runID: string };

      onRunComplete(data.runID);
    } catch {
      // ignore
    }
  }

  async function handleCancel() {
    if (!runID) return;

    try {
      await fetch(`/api/runs/${runID}`, { method: 'DELETE' });
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
        <PlaymodeToggle playmode={playmode} onChange={onPlaymodeChange} />
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

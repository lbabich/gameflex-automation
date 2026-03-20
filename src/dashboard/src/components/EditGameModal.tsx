import { useState } from 'react';
import { useUpdateGame } from '../hooks/useUpdateGame';
import type { GameEntry } from '../types';

type Props = {
  game: GameEntry;
  onClose: () => void;
};

export function EditGameModal({ game, onClose }: Props) {
  const [name, setName] = useState(game.name);
  const [desktopGameID, setDesktopGameID] = useState(game.desktopGameID);
  const [mobileGameID, setMobileGameID] = useState(game.mobileGameID ?? '');
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending } = useUpdateGame();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    mutate(
      {
        id: game.id,
        name: name.trim(),
        desktopGameID: desktopGameID.trim(),
        mobileGameID: mobileGameID.trim() || undefined,
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setError((err as Error).message),
      },
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-5">Edit Game</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Desktop Game ID</span>
            <input
              type="text"
              value={desktopGameID}
              onChange={(e) => setDesktopGameID(e.target.value)}
              required
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">
              Mobile Game ID <span className="text-gray-400 font-normal">(optional)</span>
            </span>
            <input
              type="text"
              value={mobileGameID}
              onChange={(e) => setMobileGameID(e.target.value)}
              placeholder="e.g. 13724"
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {(desktopGameID.trim() !== game.desktopGameID || (mobileGameID.trim() || undefined) !== game.mobileGameID) && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Changing a game ID will clear all cached steps for this game.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

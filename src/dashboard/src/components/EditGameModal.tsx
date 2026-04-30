import { useState } from 'react';
import { useDeleteGame } from '../hooks/useDeleteGame';
import { useUpdateGame } from '../hooks/useUpdateGame';
import type { GameEntry } from '@shared/types';

type Props = {
  game: GameEntry;
  onClose: () => void;
  onDelete: () => void;
};

export function EditGameModal({ game, onClose, onDelete }: Props) {
  const [name, setName] = useState(game.name);
  const [desktopGameID, setDesktopGameID] = useState(game.desktopGameID);
  const [mobileGameID, setMobileGameID] = useState(game.mobileGameID ?? '');
  const [gameProviderID, setGameProviderID] = useState(game.gameProviderID);
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending } = useUpdateGame();
  const { mutate: deleteGameMutate, isPending: isDeleting } = useDeleteGame();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    mutate(
      {
        id: game.id,
        name: name.trim(),
        desktopGameID: desktopGameID.trim(),
        mobileGameID: mobileGameID.trim() || undefined,
        gameProviderID: gameProviderID.trim(),
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setError((err as Error).message),
      },
    );
  }

  function handleDelete() {
    setError(null);
    deleteGameMutate(game.id, {
      onSuccess: () => {
        onDelete();
        onClose();
      },
      onError: (err) => setError((err as Error).message),
    });
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

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Game Provider ID</span>
            <input
              type="text"
              value={gameProviderID}
              onChange={(e) => setGameProviderID(e.target.value)}
              placeholder="e.g. 51"
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {(desktopGameID.trim() !== game.desktopGameID || (mobileGameID.trim() || undefined) !== game.mobileGameID) && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Changing a game ID will clear all cached steps for this game.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isPending}
              className="px-4 py-2 text-sm rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending || isDeleting}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || isDeleting}
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

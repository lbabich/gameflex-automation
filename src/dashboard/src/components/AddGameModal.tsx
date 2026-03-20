import { useState } from 'react';
import { type NewGame, useAddGame } from '../hooks/useAddGame';

type Props = {
  onClose: () => void;
};

const DEFAULTS: NewGame = {
  desktopGameID: '',
  name: '',
};

export function AddGameModal({ onClose }: Props) {
  const [fields, setFields] = useState<NewGame>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending } = useAddGame();

  function set<K extends keyof NewGame>(key: K, value: NewGame[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    mutate(
      { ...fields, desktopGameID: fields.desktopGameID.trim(), name: fields.name.trim() },
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
        <h2 className="text-lg font-semibold mb-5">Add Game</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Desktop Game ID</span>
            <input
              type="text"
              value={fields.desktopGameID}
              onChange={(e) => set('desktopGameID', e.target.value)}
              required
              placeholder="e.g. 13724"
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">
              Mobile Game ID <span className="text-gray-400 font-normal">(optional)</span>
            </span>
            <input
              type="text"
              value={fields.mobileGameId ?? ''}
              onChange={(e) => set('mobileGameId', e.target.value || undefined)}
              placeholder="e.g. 13724"
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Name</span>
            <input
              type="text"
              value={fields.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="e.g. Book of Dead"
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

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
              {isPending ? 'Adding...' : 'Add Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

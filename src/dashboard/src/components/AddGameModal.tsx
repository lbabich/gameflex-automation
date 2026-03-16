import { useState } from 'react';
import { type NewGame, useAddGame } from '../hooks/useAddGame';

type Props = {
  onClose: () => void;
};

const DEFAULTS: NewGame = {
  gameId: '',
  name: '',
  channel: 'desktop',
  mode: 'demo',
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
      { ...fields, gameId: fields.gameId.trim(), name: fields.name.trim() },
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
            <span className="text-sm font-medium text-gray-700">Game ID</span>
            <input
              type="text"
              value={fields.gameId}
              onChange={(e) => set('gameId', e.target.value)}
              required
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

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Channel</span>
            <div className="flex gap-2">
              {(['desktop', 'mobile', 'both'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('channel', c)}
                  className={`flex-1 py-1.5 rounded text-sm border capitalize transition-colors ${
                    fields.channel === c
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Mode</span>
            <div className="flex gap-2">
              {(['demo', 'real'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set('mode', m)}
                  className={`flex-1 py-1.5 rounded text-sm border capitalize transition-colors ${
                    fields.mode === m
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

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

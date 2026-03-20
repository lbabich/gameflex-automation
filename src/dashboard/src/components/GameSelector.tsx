import type { GameEntry } from '../types';

type GameStatus = {
  isRunning: boolean;
  lastStatus: 'passed' | 'failed' | 'error' | null;
};

type Props = {
  games: GameEntry[];
  selectedGameID: string | null;
  gameStatuses: Record<string, GameStatus>;
  onSelect: (id: string) => void;
  onEdit: (game: GameEntry) => void;
};

export function GameSelector({ games, selectedGameID, gameStatuses, onSelect, onEdit }: Props) {
  return (
    <div className="flex flex-col gap-1 mb-4">
      {games.map((game) => {
        const status = gameStatuses[game.id];
        const isRunning = status?.isRunning ?? false;
        const lastStatus = status?.lastStatus ?? null;
        const isSelected = game.id === selectedGameID;

        return (
          <div key={game.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(game.id)}
              className={`flex-1 min-w-0 text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="flex-1 truncate">{game.name}</span>
              {isRunning && (
                <span
                  className={`w-3 h-3 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0 ${
                    isSelected ? 'border-white' : 'border-blue-600'
                  }`}
                />
              )}
              {!isRunning && lastStatus === 'passed' && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex-shrink-0">
                  pass
                </span>
              )}
              {!isRunning && lastStatus === 'failed' && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex-shrink-0">
                  fail
                </span>
              )}
              {!isRunning && lastStatus === 'error' && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 flex-shrink-0">
                  err
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onEdit(game)}
              title="Edit game"
              className={`flex-shrink-0 p-1.5 rounded text-sm transition-colors ${
                isSelected
                  ? 'text-blue-200 hover:text-white hover:bg-blue-500'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

import type { GameEntry } from '../types';

type GameStatus = {
  isRunning: boolean;
  lastStatus: 'passed' | 'failed' | 'error' | null;
};

type Props = {
  games: GameEntry[];
  selectedGameId: string | null;
  gameStatuses: Record<string, GameStatus>;
  onSelect: (gameId: string) => void;
};

export function GameSelector({ games, selectedGameId, gameStatuses, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-1 mb-4">
      {games.map((game) => {
        const status = gameStatuses[game.gameId];
        const isRunning = status?.isRunning ?? false;
        const lastStatus = status?.lastStatus ?? null;
        const isSelected = game.gameId === selectedGameId;

        return (
          <button
            key={game.gameId}
            type="button"
            onClick={() => onSelect(game.gameId)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
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
            {!isRunning && lastStatus === null && game.cached && (
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                  isSelected
                    ? 'bg-blue-500 text-blue-100'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                cached
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

import type { GameEntry } from '../types';

type Props = {
  games: GameEntry[];
  selected: string[];
  onChange: (ids: string[]) => void;
};

export function GameSelector({ games, selected, onChange }: Props) {
  const allSelected = games.length > 0 && selected.length === games.length;

  function toggleAll() {
    onChange(allSelected ? [] : games.map((g) => g.gameId));
  }

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggleAll}
        className="text-sm text-blue-600 hover:underline text-left"
      >
        {allSelected ? 'Deselect all' : 'Select all'}
      </button>
      {games.map((game) => (
        <label key={game.gameId} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(game.gameId)}
            onChange={() => toggle(game.gameId)}
            className="w-4 h-4"
          />
          <span className="text-sm">{game.name}</span>
        </label>
      ))}
    </div>
  );
}

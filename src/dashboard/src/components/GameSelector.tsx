import { GripVertical, Pencil } from 'lucide-react';
import { useState } from 'react';
import type { GameEntry } from '@shared/types';

type GameStatus = {
  isRunning: boolean;
};

type Props = {
  games: GameEntry[];
  selectedGameID: string | null;
  gameStatuses: Record<string, GameStatus>;
  onSelect: (id: string) => void;
  onEdit: (game: GameEntry) => void;
  onReorder: (ids: string[]) => void;
};

export function GameSelector({
  games,
  selectedGameID,
  gameStatuses,
  onSelect,
  onEdit,
  onReorder,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setHoverIndex(index);
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();

    if (dragIndex === null) {
      return;
    }

    const newGames = [...games];
    const [draggedGame] = newGames.splice(dragIndex, 1);

    newGames.splice(dropIndex, 0, draggedGame);

    const newIds = newGames.map((g) => g.id);

    onReorder(newIds);
    setDragIndex(null);
    setHoverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setHoverIndex(null);
  }

  return (
    <div className="flex flex-col gap-1 mb-4">
      {games.map((game, index) => {
        const status = gameStatuses[game.id];
        const isRunning = status?.isRunning ?? false;
        const isSelected = game.id === selectedGameID;

        const isDragging = dragIndex === index;
        const isHovering = hoverIndex === index && dragIndex !== null && dragIndex !== index;

        return (
          <div
            key={game.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-1 cursor-move transition-colors ${
              isDragging ? 'opacity-50' : ''
            } ${isHovering ? 'border-t-2 border-blue-500' : ''}`}
          >
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400">
              <GripVertical size={16} />
            </div>

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
              <Pencil size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

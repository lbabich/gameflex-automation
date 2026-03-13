import type { GameEntry, RunRecord, RunStatus } from '../types';

type Props = {
  runs: RunRecord[];
  games: GameEntry[];
  onSelect: (runId: string) => void;
  emptyMessage?: string;
};

function statusBadgeClass(status: RunStatus): string {
  switch (status) {
    case 'running':
      return 'bg-yellow-100 text-yellow-700';
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'error':
      return 'bg-red-100 text-red-700';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function resolveGameNames(run: RunRecord, games: GameEntry[]): string {
  const names = run.gameIds
    .map((id) => games.find((g) => g.gameId === id)?.name ?? id)
    .join(', ');
  return names;
}

export function RecentRunsList({ runs, games, onSelect, emptyMessage }: Props) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <svg
          className="w-12 h-12 text-gray-300"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
          />
        </svg>
        <p className="text-sm">{emptyMessage ?? 'Select a game to view its runs.'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Recent Runs</h2>
      {runs.map((run) => (
        <button
          key={run.runId}
          type="button"
          onClick={() => onSelect(run.runId)}
          className="w-full text-left bg-white border rounded px-4 py-3 hover:border-blue-400 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">
              {resolveGameNames(run, games)}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${statusBadgeClass(run.status)}`}>
              {run.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{formatDate(run.startedAt)}</span>
            {run.durationMs !== undefined && (
              <span>{formatDuration(run.durationMs)}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

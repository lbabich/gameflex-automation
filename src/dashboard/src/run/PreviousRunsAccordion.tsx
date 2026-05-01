import type { RunRecord, RunStatus } from '@shared/types';

type Props = {
  runs: RunRecord[];
  onSelect: (runID: string) => void;
  selectedRunID: string | null;
  onClear?: () => void;
};

function statusPillClass(status: RunStatus) {
  switch (status) {
    case 'running':
      return 'bg-yellow-100 text-yellow-700';
    case 'error':
      return 'bg-red-100 text-red-700';
    case 'cancelled':
      return 'bg-gray-100 text-gray-500';
    default:
      return null;
  }
}

function overallPassed(run: RunRecord) {
  const results = Object.values(run.results);

  if (results.length === 0) return null;

  return results.every((r) => r.status === 'passed');
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);

  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function RunHistory({ runs, onSelect, selectedRunID, onClear }: Props) {
  if (runs.length === 0) {
    return (
      <div className="w-48 shrink-0 flex flex-1 flex-col bg-white border rounded overflow-hidden">
        <div className="px-3 py-2 border-b">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Runs</span>
        </div>

        <div className="flex items-center justify-center py-8 text-xs text-gray-400">
          No runs yet
        </div>
      </div>
    );
  }

  return (
    <div className="w-48 shrink-0 flex flex-col bg-white border rounded overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Runs</span>

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="overflow-y-auto max-h-[520px] divide-y">
        {runs.map((run) => {
          const isSelected = selectedRunID === run.runID;
          const isRunning = run.status === 'running';
          const passed = overallPassed(run);

          const rowBase = 'px-3 py-2.5 cursor-pointer transition-colors';
          const rowSelected = isSelected ? 'border-l-2 border-blue-400 bg-blue-50' : '';
          const rowRunning = isRunning && !isSelected ? 'border-l-2 border-yellow-400 bg-yellow-50' : '';
          const rowHover = !isSelected ? 'hover:bg-gray-50' : '';

          return (
            <div
              key={run.runID}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(run.runID)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(run.runID)}
              className={`${rowBase} ${rowSelected} ${rowRunning} ${rowHover}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs text-gray-800 truncate">{formatTime(run.startedAt)}</span>

                {isRunning ? (
                  <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 animate-pulse" />
                ) : statusPillClass(run.status) ? (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${statusPillClass(run.status)}`}>
                    {run.status}
                  </span>
                ) : passed === true ? (
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                ) : passed === false ? (
                  <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                ) : null}
              </div>

              {run.durationMs !== undefined && (
                <div className="text-xs text-gray-400 mt-0.5">{formatDuration(run.durationMs)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

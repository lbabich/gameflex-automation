import { useState } from 'react';
import type { RunRecord, RunStatus } from '@shared/types';

type Props = {
  runs: RunRecord[];
  onSelect: (runID: string) => void;
  selectedRunID: string | null;
  onClear?: () => void;
};

function statusBadgeClass(status: RunStatus) {
  switch (status) {
    case 'running':
      return 'bg-yellow-100 text-yellow-700';
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'error':
      return 'bg-red-100 text-red-700';
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);

  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function PreviousRunsAccordion({ runs, onSelect, selectedRunID, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [openLogs, setOpenLogs] = useState<Set<string>>(new Set());

  const completedRuns = runs.filter((r) => r.status !== 'running');

  if (completedRuns.length === 0) return null;

  function toggleLog(runID: string) {
    setOpenLogs((prev) => {
      const next = new Set(prev);
      next.has(runID) ? next.delete(runID) : next.add(runID);
      return next;
    });
  }

  return (
    <div className="border rounded bg-white overflow-hidden mt-4">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Previous Runs ({completedRuns.length})</span>
          <span className="text-gray-400 text-xs select-none">{open ? '▲' : '▼'}</span>
        </button>

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-3 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors border-l shrink-0"
          >
            Clear All
          </button>
        )}
      </div>

      {open && (
        <div className="border-t divide-y">
          {completedRuns.map((run) => {
            const hasLogs = (run.logs ?? []).length > 0;
            const isSelected = selectedRunID === run.runID;
            const isLogOpen = openLogs.has(run.runID);

            return (
              <div
                key={run.runID}
                className={`${isSelected ? 'bg-blue-50 border-l-2 border-blue-400' : ''}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(run.runID)}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(run.runID)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-800">{formatDate(run.startedAt)}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${statusBadgeClass(run.status)}`}>
                      {run.status}
                    </span>
                  </div>

                  {run.durationMs !== undefined && (
                    <div className="mt-1 text-xs text-gray-400">{formatDuration(run.durationMs)}</div>
                  )}
                </div>

                {hasLogs && (
                  <div className="px-4 pb-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLog(run.runID);
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {isLogOpen ? 'Hide run log' : 'View run log'}
                    </button>

                    {isLogOpen && (
                      <textarea
                        readOnly
                        className="mt-2 w-full h-32 text-xs text-gray-600 font-mono leading-relaxed resize-y border border-gray-200 rounded p-2 bg-gray-50"
                        value={(run.logs ?? []).join('\n')}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

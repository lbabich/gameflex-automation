import { useState } from 'react';
import type { RunRecord, RunStatus } from '../types';

type Props = {
  runs: RunRecord[];
  onSelect: (runID: string) => void;
  selectedRunID: string | null;
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
  return new Date(iso).toLocaleString();
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);

  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function PreviousRunsAccordion({ runs, onSelect, selectedRunID }: Props) {
  const [open, setOpen] = useState(false);

  const completedRuns = runs.filter((r) => r.status !== 'running');

  if (completedRuns.length === 0) return null;

  return (
    <div className="border rounded bg-white overflow-hidden mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>Previous Runs ({completedRuns.length})</span>
        <span className="text-gray-400 text-xs select-none">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t divide-y">
          {completedRuns.map((run) => (
            <button
              key={run.runID}
              type="button"
              onClick={() => onSelect(run.runID)}
              className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selectedRunID === run.runID ? 'bg-blue-50 border-l-2 border-blue-400' : ''}`}
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

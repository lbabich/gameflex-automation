import { Fragment, useCallback, useEffect, useState } from 'react';
import type { RunRecord, RunStatus, TestResult } from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type Props = {
  run: RunRecord | undefined;
  isLoading: boolean;
};

function statusBannerClass(status: RunStatus): string {
  switch (status) {
    case 'running':
      return 'bg-yellow-50 text-yellow-800 border-yellow-300';
    case 'completed':
      return 'bg-green-50 text-green-800 border-green-300';
    case 'error':
      return 'bg-orange-50 text-orange-800 border-orange-300';
  }
}

function StatusBadge({ status }: { status: TestResult['status'] }) {
  const classes: Record<TestResult['status'], string> = {
    passed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    skipped: 'bg-gray-100 text-gray-600',
    timedOut: 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${classes[status]}`}>{status}</span>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b">
      <td className="py-3 px-3">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-48" />
      </td>
      <td className="py-3 px-3">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
      </td>
      <td className="py-3 px-3">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-14" />
      </td>
      <td className="py-3 px-3 text-right">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-10 ml-auto" />
      </td>
    </tr>
  );
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function ResultsPanel({ run, isLoading }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = useCallback((i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }, []);

  useEffect(() => {
    if (run?.status !== 'running') {
      setElapsedMs(0);
      return;
    }
    const start = new Date(run.startedAt).getTime();
    const tick = () => setElapsedMs(Date.now() - start);
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [run?.status, run?.startedAt]);

  if (!run && !isLoading) {
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
        <p className="text-sm">Select games and click Run Tests to start.</p>
      </div>
    );
  }

  if (isLoading && !run) {
    return <div className="p-4 text-gray-500 text-sm">Connecting...</div>;
  }

  if (!run) return null;

  const isRunning = run.status === 'running';

  const statusLabel =
    isRunning
      ? `Running — ${formatElapsed(elapsedMs)}`
      : `${run.status.charAt(0).toUpperCase() + run.status.slice(1)} in ${((run.durationMs ?? 0) / 1000).toFixed(1)}s`;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`border rounded px-4 py-3 flex items-center gap-3 font-semibold ${statusBannerClass(run.status)}`}
      >
        {isRunning && <Spinner />}
        <span>{statusLabel}</span>
        {isRunning && (
          <span className="ml-auto text-xs font-normal text-yellow-700 animate-pulse">
            Polling for results…
          </span>
        )}
      </div>

      <table className="w-full text-sm border-collapse bg-white rounded shadow-sm overflow-hidden">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left py-2 px-3 font-medium text-gray-600">Test</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Project</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">Duration</th>
          </tr>
        </thead>
        <tbody>
          {run.results.length > 0
            ? run.results.map((result, i) => {
                const hasDetails = result.stdout.length > 0 || !!result.gifUrl || (result.steps?.length ?? 0) > 0;
                return (
                <Fragment key={i}>
                  <tr
                    className={`border-b hover:bg-gray-50 ${hasDetails ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (hasDetails) toggleRow(i);
                    }}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        {hasDetails && (
                          <span className="text-gray-400 text-xs select-none">
                            {expandedRows.has(i) ? '▼' : '▶'}
                          </span>
                        )}
                        {result.title}
                      </div>
                      {result.error && (
                        <div className="text-xs text-red-600 mt-1 font-mono whitespace-pre-wrap">
                          {result.error}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-500">{result.project}</td>
                    <td className="py-2 px-3">
                      <StatusBadge status={result.status} />
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {(result.duration / 1000).toFixed(1)}s
                    </td>
                  </tr>
                  {expandedRows.has(i) && (
                    <tr className="border-b bg-gray-50">
                      <td colSpan={4} className="px-6 py-3">
                        {result.gifUrl && (
                          <img
                            src={`${API_BASE}${result.gifUrl}`}
                            alt="Test replay"
                            className="rounded mb-3 max-w-full"
                            style={{ maxHeight: '240px' }}
                          />
                        )}
                        {result.steps && result.steps.length > 0 && (
                          <div className="flex flex-col gap-1 mb-3">
                            {result.steps.map((step, si) => (
                              <div key={si} className="flex items-center gap-2 text-xs font-mono">
                                <span className={step.error ? 'text-red-500' : 'text-green-600'}>
                                  {step.error ? '✗' : '✓'}
                                </span>
                                <span className="flex-1 text-gray-700">{step.title}</span>
                                <span className="text-gray-400">
                                  {(step.duration / 1000).toFixed(1)}s
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {result.stdout.length > 0 && (
                          <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed">
                            {result.stdout.join('\n')}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
              })
            : isRunning && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}
        </tbody>
      </table>

      {!isRunning && run.results.length === 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-gray-500 text-sm">No test results found.</div>
          {run.playwrightErrors.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <div className="text-xs font-semibold text-red-700 mb-1">Playwright errors</div>
              {run.playwrightErrors.map((msg, i) => (
                <pre key={i} className="text-xs text-red-700 whitespace-pre-wrap font-mono">
                  {msg}
                </pre>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

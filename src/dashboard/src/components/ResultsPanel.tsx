import { Fragment, useCallback, useState } from 'react';
import type { DeviceType, RunRecord, TestResult } from '@shared/types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type Props = {
  run: RunRecord | undefined;
  isLoading: boolean;
};

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

export function ResultsPanel({ run, isLoading }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<DeviceType>>(new Set());
  const [openLogs, setOpenLogs] = useState<Set<DeviceType>>(new Set());

  const toggleRow = useCallback((deviceType: DeviceType) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(deviceType) ? next.delete(deviceType) : next.add(deviceType);
      return next;
    });
  }, []);

  const toggleLog = useCallback((deviceType: DeviceType) => {
    setOpenLogs((prev) => {
      const next = new Set(prev);
      next.has(deviceType) ? next.delete(deviceType) : next.add(deviceType);
      return next;
    });
  }, []);

  if (isLoading && !run) {
    return <div className="p-4 text-gray-500 text-sm">Connecting...</div>;
  }

  if (!run) return null;

  const isRunning = run.status === 'running';

  return (
    <div className="flex flex-col gap-4">
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
          {Object.keys(run.results).length > 0
            ? (Object.entries(run.results) as [DeviceType, TestResult][]).map(
                ([deviceType, result]) => {
                  const hasDetails =
                    result.stdout.some((line) => !line.startsWith('Screenshot saved:')) ||
                    !!result.gifUrl ||
                    (result.steps?.length ?? 0) > 0 ||
                    !!result.annotations;

                  return (
                    <Fragment key={deviceType}>
                      <tr
                        className={`border-b hover:bg-gray-50 ${hasDetails ? 'cursor-pointer' : ''}`}
                        onClick={() => {
                          if (hasDetails) {
                            toggleRow(deviceType);
                          }
                        }}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            {hasDetails && (
                              <span className="text-gray-400 text-xs select-none">
                                {expandedRows.has(deviceType) ? '▼' : '▶'}
                              </span>
                            )}
                            {result.title}
                          </div>
                          {result.error && (
                            <div className="text-xs text-red-600 mt-1 font-mono whitespace-pre-wrap">
                              {result.error}
                            </div>
                          )}
                          {result.failedStep && (
                            <div className="text-xs text-red-500 mt-0.5 font-mono">
                              ↳ failed at: {result.failedStep}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-500">{deviceType}</td>
                        <td className="py-2 px-3">
                          <StatusBadge status={result.status} />
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500">
                          {(result.duration / 1000).toFixed(1)}s
                        </td>
                      </tr>
                      {expandedRows.has(deviceType) && (
                        <tr className="border-b bg-gray-50">
                          <td colSpan={4} className="px-6 py-3">
                            {(result.gifUrl ||
                              (result.screenshotUrls && result.screenshotUrls.length > 0)) && (
                              <div className="flex gap-3 mb-3 flex-wrap">
                                {result.gifUrl && (
                                  <img
                                    src={`${API_BASE}${result.gifUrl}`}
                                    alt="Test replay"
                                    className="rounded"
                                    style={{ maxHeight: '240px' }}
                                  />
                                )}
                                {result.screenshotUrls?.map((url, si) => (
                                  <a
                                    key={si}
                                    href={`${API_BASE}${url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <img
                                      src={`${API_BASE}${url}`}
                                      alt={`Failure screenshot ${si + 1}`}
                                      className="rounded border border-red-200"
                                      style={{ maxHeight: '240px' }}
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                            {(result.steps?.length || result.annotations) && (
                              <div className="rounded border border-gray-200 overflow-hidden mb-3">
                                <div className="text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 border-b border-gray-200">
                                  Steps
                                </div>
                                {result.annotations?.['had-load-progress'] !== undefined && (
                                  <div
                                    className={`flex items-center gap-3 px-3 py-2 border-b border-gray-100 ${result.annotations['had-load-progress'] === 'true' ? 'bg-white' : 'bg-amber-50'}`}
                                  >
                                    <span
                                      className={`text-sm leading-none ${result.annotations['had-load-progress'] === 'true' ? 'text-green-500' : 'text-amber-500'}`}
                                    >
                                      {result.annotations['had-load-progress'] === 'true'
                                        ? '✓'
                                        : '⚠'}
                                    </span>
                                    <span className="flex-1 text-xs text-gray-700">
                                      gel.load.progress
                                    </span>
                                  </div>
                                )}
                                {result.annotations?.['load-time-ms'] !== undefined && (
                                  <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 bg-white">
                                    <span className="text-sm leading-none text-green-500">✓</span>
                                    <span className="flex-1 text-xs text-gray-700">gel.ready</span>
                                    <span className="text-xs text-gray-400">
                                      {result.annotations['load-time-ms']}ms
                                    </span>
                                  </div>
                                )}
                                {result.steps?.map((step, si) => (
                                  <div
                                    key={si}
                                    className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 border-gray-100 ${step.error ? 'bg-red-50' : 'bg-white'}`}
                                  >
                                    <span
                                      className={`text-sm leading-none ${step.error ? 'text-red-500' : 'text-green-500'}`}
                                    >
                                      {step.error ? '✗' : '✓'}
                                    </span>
                                    <span className="flex-1 text-xs text-gray-700">{step.title}</span>
                                    <span className="text-xs text-gray-400">
                                      {(step.duration / 1000).toFixed(1)}s
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {result.stdout.filter((line) => !line.startsWith('Screenshot saved:'))
                              .length > 0 && (
                              <div>
                                <button
                                  type="button"
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLog(deviceType);
                                  }}
                                >
                                  {openLogs.has(deviceType) ? 'Hide log' : 'View log'}
                                </button>

                                {openLogs.has(deviceType) && (
                                  <textarea
                                    readOnly
                                    className="mt-2 w-full h-48 text-xs text-gray-600 font-mono leading-relaxed resize-y border border-gray-200 rounded p-2 bg-gray-50"
                                    value={result.stdout
                                      .filter((line) => !line.startsWith('Screenshot saved:'))
                                      .join('\n')}
                                  />
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                },
              )
            : isRunning && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}
        </tbody>
      </table>

      {!isRunning && Object.keys(run.results).length === 0 && (
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

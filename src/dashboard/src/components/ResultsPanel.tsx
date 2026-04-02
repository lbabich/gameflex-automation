import { useCallback, useState } from 'react';
import type { DeviceType, RunRecord, TestResult, TestStep } from '@shared/types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function StepIcon({ step }: { step: TestStep }) {
  const map: Record<TestStep['status'], { icon: string; color: string }> = {
    passed: { icon: '✓', color: 'text-green-500' },
    failed: { icon: '✗', color: 'text-red-500' },
    warning: { icon: '⚠', color: 'text-yellow-500' },
    skipped: { icon: '○', color: 'text-gray-400' },
  };
  const { icon, color } = map[step.status ?? (step.error ? 'failed' : 'passed')];

  return <span className={`text-sm leading-none ${color}`}>{icon}</span>;
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

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 bg-gray-200 rounded w-32" />
        <div className="h-3 bg-gray-200 rounded w-16" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="h-2.5 bg-gray-200 rounded w-full" />
        <div className="h-2.5 bg-gray-200 rounded w-4/5" />
        <div className="h-2.5 bg-gray-200 rounded w-3/5" />
      </div>
    </div>
  );
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);

  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

type DeviceCardProps = {
  deviceType: DeviceType;
  result: TestResult;
  logOpen: boolean;
  onToggleLog: () => void;
};

type SectionState = {
  error: boolean;
  screenshots: boolean;
  steps: boolean;
};

function DeviceResultCard({ deviceType, result, logOpen, onToggleLog }: DeviceCardProps) {
  const [sections, setSections] = useState<SectionState>({
    error: false,
    screenshots: false,
    steps: false,
  });

  const toggleSection = (section: keyof SectionState) => {
    setSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const filteredLogs = (result.logs ?? []).filter((line) => !line.startsWith('Screenshot saved:'));

  const deviceLabel = deviceType === 'desktop' ? 'Desktop Chrome' : 'Mobile Chrome';

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <span className="text-sm font-semibold text-gray-700">{deviceLabel}</span>

        <div className="flex items-center gap-3">
          <StatusBadge status={result.status} />
          <span className="text-xs text-gray-400">{formatDuration(result.duration)}</span>
        </div>
      </div>

      {(result.error || result.failedStep) && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('error')}
            className="w-full flex items-center justify-between px-4 py-2 bg-red-50 border-b border-red-100 hover:bg-red-100 transition-colors"
          >
            <span className="text-xs font-medium text-red-700">
              {result.error ? 'Error' : 'Failed Step'}
            </span>
            <span className={`text-red-700 select-none transition-transform text-lg font-bold ${sections.error ? 'rotate-90' : ''}`}>
              ›
            </span>
          </button>

          {sections.error && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 font-mono whitespace-pre-wrap">
              {result.error
                ? result.error
                : `Failed at: ${result.failedStep}`}
            </div>
          )}
        </div>
      )}

      {(result.gifUrl || (result.screenshotUrls && result.screenshotUrls.length > 0)) && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('screenshots')}
            className="w-full flex items-center justify-between px-4 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xs font-medium text-gray-700">Screenshots</span>
            <span className={`text-gray-400 select-none transition-transform text-lg font-bold ${sections.screenshots ? 'rotate-90' : ''}`}>
              ›
            </span>
          </button>

          {sections.screenshots && (
            <div className="px-4 py-3 flex gap-3 flex-wrap border-b border-gray-100">
              {result.gifUrl && (
                <img
                  src={`${API_BASE}${result.gifUrl}`}
                  alt="Test replay"
                  className="rounded"
                  style={{ maxHeight: '240px' }}
                />
              )}

              {result.screenshotUrls?.map((url, si) => (
                <a key={si} href={`${API_BASE}${url}`} target="_blank" rel="noreferrer">
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
        </div>
      )}

      {(result.steps?.length ?? 0) > 0 && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('steps')}
            className="w-full flex items-center justify-between px-4 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xs font-medium text-gray-700">
              Steps ({result.steps?.length ?? 0})
            </span>
            <span className={`text-gray-400 select-none transition-transform text-lg font-bold ${sections.steps ? 'rotate-90' : ''}`}>
              ›
            </span>
          </button>

          {sections.steps && (
            <div className="divide-y divide-gray-100">
              {result.steps?.map((step, si) => {
                const rowBg =
                  step.status === 'failed'
                    ? 'bg-red-50'
                    : step.status === 'warning'
                      ? 'bg-yellow-50'
                      : '';
                const textColor = step.status === 'skipped' ? 'text-gray-400' : 'text-gray-700';

                return (
                  <div key={si} className={`flex items-center gap-3 px-4 py-2 ${rowBg}`}>
                    <StepIcon step={step} />

                    <div className="flex-1 min-w-0">
                      <span className={`text-xs ${textColor}`}>{step.title}</span>

                      {step.error && (
                        <div className="text-xs text-red-500 font-mono mt-0.5">{step.error}</div>
                      )}
                    </div>

                    {step.status !== 'skipped' && (
                      <span className="text-xs text-gray-400 shrink-0">
                        {(step.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {filteredLogs.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline"
            onClick={onToggleLog}
          >
            {logOpen ? 'Hide log' : 'View log'}
          </button>

          {logOpen && (
            <textarea
              readOnly
              className="mt-2 w-full h-48 text-xs text-gray-600 font-mono leading-relaxed resize-y border border-gray-200 rounded p-2 bg-gray-50"
              value={filteredLogs.join('\n')}
            />
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  run: RunRecord | undefined;
  isLoading: boolean;
};

export function ResultsPanel({ run, isLoading }: Props) {
  const [openLogs, setOpenLogs] = useState<Set<DeviceType>>(new Set());
  const [openRunLog, setOpenRunLog] = useState(false);

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
  const resultEntries = Object.entries(run.results) as [DeviceType, TestResult][];
  const allDevices: DeviceType[] = ['desktop', 'mobile'];
  const missingDevices = isRunning
    ? allDevices.filter((d) => !(d in run.results))
    : [];

  return (
    <div className="flex flex-col gap-3">
      {resultEntries.map(([deviceType, result]) => (
        <DeviceResultCard
          key={deviceType}
          deviceType={deviceType}
          result={result}
          logOpen={openLogs.has(deviceType)}
          onToggleLog={() => toggleLog(deviceType)}
        />
      ))}

      {missingDevices.map((d) => (
        <SkeletonCard key={d} />
      ))}

      {!isRunning && resultEntries.length === 0 && (
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

      {(run.logs ?? []).length > 0 && (
        <div className="rounded border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenRunLog((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>Run Log ({(run.logs ?? []).length} entries)</span>
            <span className="text-gray-400 select-none">{openRunLog ? '▲' : '▼'}</span>
          </button>

          {openRunLog && (
            <textarea
              readOnly
              className="w-full h-48 text-xs text-gray-600 font-mono leading-relaxed resize-y border-t border-gray-200 p-2 bg-gray-50"
              value={(run.logs ?? []).join('\n')}
            />
          )}
        </div>
      )}
    </div>
  );
}

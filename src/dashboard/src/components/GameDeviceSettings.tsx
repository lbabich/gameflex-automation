import { useState } from 'react';
import { useClearChannelSteps } from '../hooks/useClearChannelSteps';
import { useUpdateGame } from '../hooks/useUpdateGame';
import type { GameEntry } from '../types';

type RunStatus = 'passed' | 'failed' | 'error' | null;

type Props = {
  game: GameEntry;
  isRunning: boolean;
  desktopLastStatus: RunStatus;
  mobileLastStatus: RunStatus;
  onRunComplete: (runId: string) => void;
};

type DeviceCardProps = {
  label: string;
  playmode: 'demo' | 'real';
  isRunning: boolean;
  resetPending: boolean;
  launchPending: boolean;
  cached: boolean;
  lastStatus: RunStatus;
  onLaunch: () => void;
  onTogglePlaymode: (mode: 'demo' | 'real') => void;
  onReset: () => void;
};

function DeviceCard({
  label,
  playmode,
  isRunning,
  resetPending,
  launchPending,
  cached,
  lastStatus,
  onLaunch,
  onTogglePlaymode,
  onReset,
}: DeviceCardProps) {
  return (
    <div className="flex-1 border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          {cached && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
              cached
            </span>
          )}
          {lastStatus === 'passed' && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
              pass
            </span>
          )}
          {lastStatus === 'failed' && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
              fail
            </span>
          )}
          {lastStatus === 'error' && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
              err
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={isRunning || resetPending}
            className="px-2 py-1 rounded text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onLaunch}
            disabled={isRunning || launchPending}
            className="px-3 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Launch
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        {(['demo', 'real'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onTogglePlaymode(m)}
            className={`flex-1 py-1 rounded text-xs border capitalize transition-colors ${
              playmode === m
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GameDeviceSettings({
  game,
  isRunning,
  desktopLastStatus,
  mobileLastStatus,
  onRunComplete,
}: Props) {
  const { mutate } = useUpdateGame();
  const clearChannel = useClearChannelSteps();
  const [pendingDevice, setPendingDevice] = useState<'desktop' | 'mobile' | null>(null);

  function patch(
    updates: Partial<Pick<GameEntry, 'desktopPlaymode' | 'mobilePlaymode'>>,
  ) {
    mutate({ id: game.id, ...updates });
  }

  async function handleLaunch(project: 'desktop' | 'mobile') {
    setPendingDevice(project);

    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameIds: [game.id], projects: [project] }),
      });

      if (!res.ok) return;

      const data = (await res.json()) as { runId: string };

      onRunComplete(data.runId);
    } catch {
      // ignore
    } finally {
      setPendingDevice(null);
    }
  }

  return (
    <div className="flex gap-3 mb-4">
      <DeviceCard
        label="Desktop"
        playmode={game.desktopPlaymode}
        isRunning={isRunning}
        resetPending={clearChannel.isPending}
        launchPending={pendingDevice === 'chromium'}
        cached={game.desktopCached ?? false}
        lastStatus={desktopLastStatus}
        onLaunch={() => handleLaunch('desktop')}
        onTogglePlaymode={(mode) => patch({ desktopPlaymode: mode })}
        onReset={() => clearChannel.mutate({ id: game.id, deviceType: 'desktop' })}
      />
      <DeviceCard
        label="Mobile"
        playmode={game.mobilePlaymode}
        isRunning={isRunning}
        resetPending={clearChannel.isPending}
        launchPending={pendingDevice === 'mobile-chrome'}
        cached={game.mobileCached ?? false}
        lastStatus={mobileLastStatus}
        onLaunch={() => handleLaunch('mobile')}
        onTogglePlaymode={(mode) => patch({ mobilePlaymode: mode })}
        onReset={() => clearChannel.mutate({ id: game.id, deviceType: 'mobile' })}
      />
    </div>
  );
}

import { useState } from 'react';
import { useClearChannelSteps } from '../hooks/useClearChannelSteps';
import { DEVICE_TYPE } from '../types';
import type { DeviceType, GameEntry } from '../types';

type RunStatus = 'passed' | 'failed' | 'error' | null;

type Props = {
  game: GameEntry;
  isRunning: boolean;
  desktopLastStatus: RunStatus;
  mobileLastStatus: RunStatus;
  onRunComplete: (runID: string) => void;
};

type DeviceCardProps = {
  label: string;
  isRunning: boolean;
  resetPending: boolean;
  launchPending: boolean;
  cached: boolean;
  lastStatus: RunStatus;
  onLaunch: () => void;
  onReset: () => void;
};


function DeviceCard({
  label,
  isRunning,
  resetPending,
  launchPending,
  cached,
  lastStatus,
  onLaunch,
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
        <button
          type="button"
          onClick={onReset}
          disabled={isRunning || resetPending}
          className="px-2 py-1 rounded text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Reset
        </button>
      </div>
      <button
        type="button"
        onClick={onLaunch}
        disabled={isRunning || launchPending}
        className="w-full py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        Launch
      </button>
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
  const clearChannel = useClearChannelSteps();
  const [pendingDevice, setPendingDevice] = useState<DeviceType | null>(null);

  async function handleLaunch(project: DeviceType) {
    setPendingDevice(project);

    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameIDs: [game.id], projects: [project] }),
      });

      if (!res.ok) return;

      const data = (await res.json()) as { runID: string };

      onRunComplete(data.runID);
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
          isRunning={isRunning}
          resetPending={clearChannel.isPending}
          launchPending={pendingDevice === DEVICE_TYPE.DESKTOP}
          cached={game.desktopCached ?? false}
          lastStatus={desktopLastStatus}
          onLaunch={() => handleLaunch(DEVICE_TYPE.DESKTOP)}
          onReset={() => clearChannel.mutate({ id: game.id, deviceType: DEVICE_TYPE.DESKTOP })}
        />
        <DeviceCard
          label="Mobile"
          isRunning={isRunning}
          resetPending={clearChannel.isPending}
          launchPending={pendingDevice === DEVICE_TYPE.MOBILE}
          cached={game.mobileCached ?? false}
          lastStatus={mobileLastStatus}
          onLaunch={() => handleLaunch(DEVICE_TYPE.MOBILE)}
          onReset={() => clearChannel.mutate({ id: game.id, deviceType: DEVICE_TYPE.MOBILE })}
        />
    </div>
  );
}

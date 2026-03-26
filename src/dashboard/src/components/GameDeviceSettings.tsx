import { useState } from 'react';
import { createRun } from '../api';
import { useClearChannelSteps } from '../hooks/useClearChannelSteps';
import { DEVICE_TYPE } from '@shared/types';
import type { DeviceType, GameEntry, PlayMode } from '@shared/types';

type Props = {
  game: GameEntry;
  isRunning: boolean;
  playmode: PlayMode;
  onRunComplete: (runID: string) => void;
};

type DeviceCardProps = {
  label: string;
  isRunning: boolean;
  resetPending: boolean;
  launchPending: boolean;
  onLaunch: () => void;
  onReset: () => void;
};


function DeviceCard({
  label,
  isRunning,
  resetPending,
  launchPending,
  onLaunch,
  onReset,
}: DeviceCardProps) {
  return (
    <div className="flex-1 border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
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
  playmode,
  onRunComplete,
}: Props) {
  const clearChannel = useClearChannelSteps();
  const [pendingDevice, setPendingDevice] = useState<DeviceType | null>(null);

  async function handleLaunch(deviceType: DeviceType) {
    setPendingDevice(deviceType);

    try {
      const data = await createRun({ gameIDs: [game.id], deviceTypes: [deviceType], playmode });

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
          onLaunch={() => handleLaunch(DEVICE_TYPE.DESKTOP)}
          onReset={() => clearChannel.mutate({ id: game.id, deviceType: DEVICE_TYPE.DESKTOP })}
        />
        <DeviceCard
          label="Mobile"
          isRunning={isRunning}
          resetPending={clearChannel.isPending}
          launchPending={pendingDevice === DEVICE_TYPE.MOBILE}
          onLaunch={() => handleLaunch(DEVICE_TYPE.MOBILE)}
          onReset={() => clearChannel.mutate({ id: game.id, deviceType: DEVICE_TYPE.MOBILE })}
        />
    </div>
  );
}

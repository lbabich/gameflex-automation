import { useClearChannelSteps } from '../hooks/useClearChannelSteps';
import { useUpdateGame } from '../hooks/useUpdateGame';
import type { GameEntry } from '../types';

type RunStatus = 'passed' | 'failed' | 'error' | null;

type Props = {
  game: GameEntry;
  isRunning: boolean;
  desktopLastStatus: RunStatus;
  mobileLastStatus: RunStatus;
};

type DeviceCardProps = {
  label: string;
  enabled: boolean;
  playmode: 'demo' | 'real';
  isRunning: boolean;
  resetPending: boolean;
  cached: boolean;
  lastStatus: RunStatus;
  onToggleEnabled: () => void;
  onTogglePlaymode: (mode: 'demo' | 'real') => void;
  onReset: () => void;
};

function DeviceCard({
  label,
  enabled,
  playmode,
  isRunning,
  resetPending,
  cached,
  lastStatus,
  onToggleEnabled,
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
            onClick={onToggleEnabled}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              enabled
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
            }`}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        {(['demo', 'real'] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={!enabled}
            onClick={() => onTogglePlaymode(m)}
            className={`flex-1 py-1 rounded text-xs border capitalize transition-colors ${
              playmode === m && enabled
                ? 'bg-blue-600 text-white border-blue-600'
                : enabled
                  ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GameDeviceSettings({ game, isRunning, desktopLastStatus, mobileLastStatus }: Props) {
  const { mutate } = useUpdateGame();
  const clearChannel = useClearChannelSteps();

  function patch(
    updates: Partial<Pick<GameEntry, 'desktopEnabled' | 'desktopPlaymode' | 'mobileEnabled' | 'mobilePlaymode'>>,
  ) {
    mutate({ id: game.id, ...updates });
  }

  return (
    <div className="flex gap-3 mb-4">
      <DeviceCard
        label="Desktop"
        enabled={game.desktopEnabled}
        playmode={game.desktopPlaymode}
        isRunning={isRunning}
        resetPending={clearChannel.isPending}
        cached={game.desktopCached ?? false}
        lastStatus={desktopLastStatus}
        onToggleEnabled={() => patch({ desktopEnabled: !game.desktopEnabled })}
        onTogglePlaymode={(mode) => patch({ desktopPlaymode: mode })}
        onReset={() => clearChannel.mutate({ id: game.id, deviceType: 'desktop' })}
      />
      <DeviceCard
        label="Mobile"
        enabled={game.mobileEnabled}
        playmode={game.mobilePlaymode}
        isRunning={isRunning}
        resetPending={clearChannel.isPending}
        cached={game.mobileCached ?? false}
        lastStatus={mobileLastStatus}
        onToggleEnabled={() => patch({ mobileEnabled: !game.mobileEnabled })}
        onTogglePlaymode={(mode) => patch({ mobilePlaymode: mode })}
        onReset={() => clearChannel.mutate({ id: game.id, deviceType: 'mobile' })}
      />
    </div>
  );
}

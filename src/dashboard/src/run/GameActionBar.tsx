import { useEffect, useRef, useState } from 'react';
import type { DeviceType, GameEntry, RunHints } from '@shared/types';
import { DEVICE_TYPE } from '@shared/types';
import { useGameCatalog } from '../game-catalog';
import { DEFAULT_STEPS, createRun, deleteRun } from '../shared/api';
import { useClearGameMemory } from './useClearGameMemory';

const ALL_DEVICES: DeviceType[] = [DEVICE_TYPE.DESKTOP, DEVICE_TYPE.MOBILE];
const DEVICE_LABEL: Record<DeviceType, string> = { desktop: 'Desktop', mobile: 'Mobile' };

type ExtraItem = {
  label: string;
  onClick: () => void;
};

type SplitDropdownButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  selected: Set<DeviceType>;
  onToggle: (d: DeviceType) => void;
  mainButtonClass: string;
  chevronClass: string;
  extraItems?: ExtraItem[];
};

function SplitDropdownButton(props: SplitDropdownButtonProps) {
  const {
    label,
    onClick,
    disabled,
    selected,
    onToggle,
    mainButtonClass,
    chevronClass,
    extraItems,
  } = props;
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) document.addEventListener('mousedown', handleOutside);

    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div className="relative flex" ref={wrapperRef}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || selected.size === 0}
        className={`px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${mainButtonClass}`}
      >
        {label}
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Select devices"
        className={`px-2 py-1.5 text-xs transition-colors disabled:opacity-50 ${chevronClass}`}
      >
        ▾
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded shadow-md z-10 py-1 min-w-[140px]">
          {ALL_DEVICES.map((d) => (
            <label
              key={d}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={selected.has(d)}
                onChange={() => onToggle(d)}
                className="rounded"
              />
              {DEVICE_LABEL[d]}
            </label>
          ))}

          {extraItems && extraItems.length > 0 && (
            <>
              <hr className="my-1 border-gray-200" />

              {extraItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  game: GameEntry;
  isRunning: boolean;
  runID: string | null;
  runDevices: Set<DeviceType>;
  resetCacheDevices: Set<DeviceType>;
  onToggleRunDevice: (d: DeviceType) => void;
  onToggleResetDevice: (d: DeviceType) => void;
  hints: RunHints | undefined;
  onRunComplete: (runID: string) => void;
  onMemoryCleared?: () => void;
};

export function GameActionBar(props: Props) {
  const {
    game,
    isRunning,
    runID,
    runDevices,
    resetCacheDevices,
    onToggleRunDevice,
    onToggleResetDevice,
    hints,
    onRunComplete,
    onMemoryCleared,
  } = props;
  const { clearAllSteps, clearDeviceSteps } = useGameCatalog();
  const clearMemory = useClearGameMemory();

  function runLabel() {
    if (runDevices.has('desktop') && runDevices.has('mobile')) {
      return 'Run Both';
    }

    if (runDevices.has('desktop')) {
      return 'Run Desktop';
    }

    if (runDevices.has('mobile')) {
      return 'Run Mobile';
    }

    return 'Run';
  }

  function resetLabel() {
    if (resetCacheDevices.has('desktop') && resetCacheDevices.has('mobile')) {
      return 'Reset Cache';
    }

    if (resetCacheDevices.has('desktop')) {
      return 'Reset Desktop';
    }

    if (resetCacheDevices.has('mobile')) {
      return 'Reset Mobile';
    }

    return 'Reset Cache';
  }

  async function handleRun() {
    if (isRunning || runDevices.size === 0) {
      return;
    }

    try {
      const data = await createRun({
        gameIDs: [game.id],
        deviceTypes: [...runDevices] as DeviceType[],
        steps: [...DEFAULT_STEPS],
        hints,
      });

      onRunComplete(data.runID);
    } catch (e) {
      console.warn('Failed to create run:', e);
    }
  }

  async function handleCancel() {
    if (!runID) return;

    try {
      await deleteRun(runID);
    } catch (e) {
      console.warn('Failed to cancel run:', e);
    }
  }

  function handleReset() {
    if (resetCacheDevices.size === ALL_DEVICES.length) {
      clearAllSteps.mutate(game.id);
    } else if (resetCacheDevices.has('desktop')) {
      clearDeviceSteps.mutate({ id: game.id, deviceType: DEVICE_TYPE.DESKTOP });
    } else if (resetCacheDevices.has('mobile')) {
      clearDeviceSteps.mutate({ id: game.id, deviceType: DEVICE_TYPE.MOBILE });
    }
  }

  const resetPending = clearAllSteps.isPending || clearDeviceSteps.isPending || clearMemory.isPending;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border rounded mb-4">
      <span className="font-semibold text-gray-800">{game.name}</span>

      <div className="flex gap-2 items-center">
        {isRunning ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={!runID}
            className="px-3 py-1.5 rounded text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        ) : (
          <SplitDropdownButton
            label={runLabel()}
            onClick={handleRun}
            selected={runDevices}
            onToggle={onToggleRunDevice}
            mainButtonClass="rounded-l bg-blue-600 text-white hover:bg-blue-700"
            chevronClass="rounded-r bg-blue-600 text-white hover:bg-blue-700 border-l border-blue-500"
          />
        )}

        <SplitDropdownButton
          label={resetLabel()}
          onClick={handleReset}
          disabled={isRunning || resetPending}
          selected={resetCacheDevices}
          onToggle={onToggleResetDevice}
          mainButtonClass="rounded-l border-t border-b border-l border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          chevronClass="rounded-r border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          extraItems={[{
            label: 'Reset All Memory',
            onClick: () => clearMemory.mutate(game.id, { onSuccess: onMemoryCleared }),
          }]}
        />
      </div>
    </div>
  );
}

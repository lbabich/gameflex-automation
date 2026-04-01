import { useEffect, useRef, useState } from 'react';
import { DEFAULT_STEPS, createRun, deleteRun } from '../api';
import { useClearChannelSteps } from '../hooks/useClearChannelSteps';
import { useClearSteps } from '../hooks/useClearSteps';
import { DEVICE_TYPE } from '@shared/types';
import type { DeviceType, GameEntry } from '@shared/types';

const ALL_DEVICES: DeviceType[] = [DEVICE_TYPE.DESKTOP, DEVICE_TYPE.MOBILE];
const DEVICE_LABEL: Record<DeviceType, string> = { desktop: 'Desktop', mobile: 'Mobile' };

type SplitDropdownButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  selected: Set<DeviceType>;
  onToggle: (d: DeviceType) => void;
  mainButtonClass: string;
  chevronClass: string;
};

function SplitDropdownButton({
  label,
  onClick,
  disabled,
  selected,
  onToggle,
  mainButtonClass,
  chevronClass,
}: SplitDropdownButtonProps) {
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
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded shadow-md z-10 py-1 min-w-[120px]">
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
        </div>
      )}
    </div>
  );
}

type Props = {
  game: GameEntry;
  isRunning: boolean;
  runID: string | null;
  spinCycleHint: string;
  gameCloseHint: string;
  audioToggleHint: string;
  onRunComplete: (runID: string) => void;
};

export function GameActionBar({
  game,
  isRunning,
  runID,
  spinCycleHint,
  gameCloseHint,
  audioToggleHint,
  onRunComplete,
}: Props) {
  const clearSteps = useClearSteps();
  const clearChannel = useClearChannelSteps();

  const [runDevices, setRunDevices] = useState<Set<DeviceType>>(new Set(ALL_DEVICES));
  const [resetDevices, setResetDevices] = useState<Set<DeviceType>>(new Set(ALL_DEVICES));

  function toggleRunDevice(d: DeviceType) {
    setRunDevices((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  }

  function toggleResetDevice(d: DeviceType) {
    setResetDevices((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  }

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
    if (resetDevices.has('desktop') && resetDevices.has('mobile')) return 'Reset Cache';
    if (resetDevices.has('desktop')) return 'Reset Desktop';
    if (resetDevices.has('mobile')) return 'Reset Mobile';

    return 'Reset Cache';
  }

  async function handleRun() {
    if (isRunning || runDevices.size === 0) return;

    const hints =
      spinCycleHint || gameCloseHint || audioToggleHint
        ? {
            spinCycle: spinCycleHint || undefined,
            gameClose: gameCloseHint || undefined,
            audioToggle: audioToggleHint || undefined,
          }
        : undefined;

    try {
      const data = await createRun({
        gameIDs: [game.id],
        deviceTypes: [...runDevices] as DeviceType[],
        steps: [...DEFAULT_STEPS],
        hints,
      });

      onRunComplete(data.runID);
    } catch {
      // ignore
    }
  }

  async function handleCancel() {
    if (!runID) return;

    try {
      await deleteRun(runID);
    } catch {
      // ignore
    }
  }

  function handleReset() {
    if (resetDevices.size === ALL_DEVICES.length) {
      clearSteps.mutate(game.id);
    } else if (resetDevices.has('desktop')) {
      clearChannel.mutate({ id: game.id, deviceType: DEVICE_TYPE.DESKTOP });
    } else if (resetDevices.has('mobile')) {
      clearChannel.mutate({ id: game.id, deviceType: DEVICE_TYPE.MOBILE });
    }
  }

  const resetPending = clearSteps.isPending || clearChannel.isPending;

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
            onToggle={toggleRunDevice}
            mainButtonClass="rounded-l bg-blue-600 text-white hover:bg-blue-700"
            chevronClass="rounded-r bg-blue-600 text-white hover:bg-blue-700 border-l border-blue-500"
          />
        )}

        <SplitDropdownButton
          label={resetLabel()}
          onClick={handleReset}
          disabled={isRunning || resetPending}
          selected={resetDevices}
          onToggle={toggleResetDevice}
          mainButtonClass="rounded-l border-t border-b border-l border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          chevronClass="rounded-r border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        />
      </div>
    </div>
  );
}

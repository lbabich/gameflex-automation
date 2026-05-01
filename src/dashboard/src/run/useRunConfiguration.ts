import { useEffect, useState } from 'react';
import type { DeviceType } from '@shared/types';
import { DEVICE_TYPE } from '@shared/types';
import { useLocalStorage } from '../shared/useLocalStorage';

const ALL_DEVICES: DeviceType[] = [DEVICE_TYPE.DESKTOP, DEVICE_TYPE.MOBILE];

export function useRunConfiguration(selectedGameID: string | null) {
  const storage = useLocalStorage();

  const [runDevices, setRunDevices] = useState<Set<DeviceType>>(
    new Set(storage.getItem<DeviceType[]>('run_devices') ?? ALL_DEVICES),
  );
  const [resetCacheDevices, setResetCacheDevices] = useState<Set<DeviceType>>(
    new Set(storage.getItem<DeviceType[]>('cache_reset_devices') ?? ALL_DEVICES),
  );
  const [spinCycleHint, setSpinCycleHint] = useState('');
  const [gameCloseHint, setGameCloseHint] = useState('');
  const [audioToggleHint, setAudioToggleHint] = useState('');

  useEffect(() => {
    setSpinCycleHint('');
    setGameCloseHint('');
    setAudioToggleHint('');
  }, [selectedGameID]);

  function toggleRunDevice(d: DeviceType) {
    setRunDevices((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      storage.setItem('run_devices', Array.from(next));
      return next;
    });
  }

  function toggleResetDevice(d: DeviceType) {
    setResetCacheDevices((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      storage.setItem('cache_reset_devices', Array.from(next));
      return next;
    });
  }

  const hints =
    spinCycleHint || gameCloseHint || audioToggleHint
      ? {
          spinCycle: spinCycleHint || undefined,
          gameClose: gameCloseHint || undefined,
          audioToggle: audioToggleHint || undefined,
        }
      : undefined;

  return {
    runDevices,
    resetCacheDevices,
    toggleRunDevice,
    toggleResetDevice,
    spinCycleHint,
    setSpinCycleHint,
    gameCloseHint,
    setGameCloseHint,
    audioToggleHint,
    setAudioToggleHint,
    hints,
  };
}

import { useState } from 'react';

type Props = {
  spinCycleHint: string;
  gameCloseHint: string;
  audioToggleHint: string;
  onSpinHintChange: (value: string) => void;
  onCloseHintChange: (value: string) => void;
  onAudioToggleHintChange: (value: string) => void;
};

const TABS = [
  {
    key: 'spinCycle' as const,
    label: 'Spin',
    placeholder: 'Describe the spin button or steps needed to reach it...',
  },
  {
    key: 'audioToggle' as const,
    label: 'Audio',
    placeholder: 'Describe the audio toggle button or steps needed to reach it...',
  },
  {
    key: 'gameClose' as const,
    label: 'Close',
    placeholder: 'Describe how to close the game...',
  },
];

type TabKey = (typeof TABS)[number]['key'];

export function DiscoveryHints({
  spinCycleHint,
  gameCloseHint,
  audioToggleHint,
  onSpinHintChange,
  onCloseHintChange,
  onAudioToggleHintChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('spinCycle');

  const values: Record<TabKey, string> = {
    spinCycle: spinCycleHint,
    audioToggle: audioToggleHint,
    gameClose: gameCloseHint,
  };

  const handlers: Record<TabKey, (v: string) => void> = {
    spinCycle: onSpinHintChange,
    audioToggle: onAudioToggleHintChange,
    gameClose: onCloseHintChange,
  };

  const active = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="bg-white border rounded p-4 mb-4">
      <div className="flex gap-1 border-b mb-3">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const hasContent = values[tab.key].trim() !== '';

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                'px-3 py-1.5 text-xs font-semibold rounded-t transition-colors',
                isActive
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab.label}
              {hasContent && (
                <span className="ml-1 text-blue-400">●</span>
              )}
            </button>
          );
        })}
      </div>

      <textarea
        value={values[activeTab]}
        onChange={(e) => handlers[activeTab](e.target.value)}
        placeholder={active.placeholder}
        className="w-full text-sm border rounded px-2 py-1.5 text-gray-800 resize-y min-h-[60px]"
      />
    </div>
  );
}

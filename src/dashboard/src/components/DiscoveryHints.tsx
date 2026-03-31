type Props = {
  spinCycleHint: string;
  gameCloseHint: string;
  onSpinHintChange: (value: string) => void;
  onCloseHintChange: (value: string) => void;
};

export function DiscoveryHints({
  spinCycleHint,
  gameCloseHint,
  onSpinHintChange,
  onCloseHintChange,
}: Props) {
  return (
    <div className="bg-white border rounded p-4 mb-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Spin hint</label>
          <textarea
            value={spinCycleHint}
            onChange={(e) => onSpinHintChange(e.target.value)}
            placeholder="Describe the spin button or steps needed to reach it..."
            className="text-sm border rounded px-2 py-1.5 text-gray-800 resize-y min-h-[60px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Close hint</label>
          <textarea
            value={gameCloseHint}
            onChange={(e) => onCloseHintChange(e.target.value)}
            placeholder="Describe how to close the game..."
            className="text-sm border rounded px-2 py-1.5 text-gray-800 resize-y min-h-[60px]"
          />
        </div>
      </div>
    </div>
  );
}

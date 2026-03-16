type Props = {
  disabled: boolean;
  running: boolean;
  onClick: () => void;
};

export function RunButton({ disabled, running, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`mt-4 w-full px-4 py-2 rounded text-white font-semibold transition-colors disabled:cursor-not-allowed ${
        running
          ? 'bg-yellow-500 opacity-80 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
      }`}
    >
      {running ? 'Running...' : 'Run Tests'}
    </button>
  );
}

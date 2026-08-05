// Extracted from Sidebar.tsx's ThemeToggle (same pill-with-sliding-thumb
// visual: h-6 w-11 rounded-full, bg-primary when on / bg-surface-hover
// bordered when off) so any other boolean setting in the app -- starting
// with NotificationPreferences.tsx -- gets the exact same switch control
// instead of a one-off checkbox or a differently styled toggle.
interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

export default function ToggleSwitch({ checked, onChange, disabled, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-primary' : 'bg-surface-hover border border-border-default'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
          checked ? 'right-0.5' : 'left-0.5'
        }`}
      />
    </button>
  );
}

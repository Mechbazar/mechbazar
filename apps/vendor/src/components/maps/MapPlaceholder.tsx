import { MapPin } from 'lucide-react';

interface MapPlaceholderProps {
  label: string;
  height?: number;
}

// Rendered wherever a real Google Map would go once MAPS_ENABLED is true --
// an honest "not available" state instead of a broken embed, mirroring
// apps/mobile's components/shared/MapPlaceholder.tsx.
export default function MapPlaceholder({ label, height = 220 }: MapPlaceholderProps) {
  return (
    <div
      style={{ height }}
      className="rounded-xl border border-dashed border-border-default bg-surface-sunken flex flex-col items-center justify-center gap-1"
    >
      <MapPin className="w-6 h-6 text-content-muted" />
      <p className="text-sm font-semibold text-content-secondary">{label}</p>
      <p className="text-xs text-content-muted">Map view unavailable</p>
    </div>
  );
}

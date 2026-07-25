import { MapPin } from 'lucide-react';

interface MapPlaceholderProps {
  label: string;
  height?: number;
}

// Rendered wherever a real Google Map would go once MAPS_ENABLED is true --
// an honest "not available" state instead of a broken embed, mirroring
// apps/vendor/src/components/maps/MapPlaceholder.tsx.
export default function MapPlaceholder({ label, height = 220 }: MapPlaceholderProps) {
  return (
    <div
      style={{ height }}
      className="rounded-xl border border-dashed border-neutral-700 bg-neutral-950 flex flex-col items-center justify-center gap-1"
    >
      <MapPin className="w-6 h-6 text-neutral-600" />
      <p className="text-sm font-semibold text-neutral-400">{label}</p>
      <p className="text-xs text-neutral-600">Map view unavailable</p>
    </div>
  );
}

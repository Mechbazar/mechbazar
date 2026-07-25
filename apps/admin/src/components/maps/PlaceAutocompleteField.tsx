import { useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import {
  autocomplete,
  placeDetails,
  createSessionToken,
} from '../../services/geocode.service';
import type { GeocodeSuccess, AutocompletePrediction } from '../../services/geocode.service';

interface PlaceAutocompleteFieldProps {
  onSelect: (result: GeocodeSuccess) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 350;
const MIN_CHARS = 3;

// Ported from apps/vendor/src/components/maps/PlaceAutocompleteField.tsx --
// web text input + dropdown backed by the backend's /api/geocode/autocomplete
// and /api/geocode/place/:placeId proxies.
export default function PlaceAutocompleteField({ onSelect, placeholder }: PlaceAutocompleteFieldProps) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const sessionTokenRef = useRef(createSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (input: string) => {
    setQuery(input);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.trim().length < MIN_CHARS) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const result = await autocomplete(input.trim(), { sessionToken: sessionTokenRef.current, country: 'in' });
      setLoading(false);
      setPredictions(result.ok ? result.predictions : []);
    }, DEBOUNCE_MS);
  };

  const handleSelect = async (prediction: AutocompletePrediction) => {
    setPredictions([]);
    setQuery(prediction.description);
    setResolving(true);
    const result = await placeDetails(prediction.placeId, { sessionToken: sessionTokenRef.current });
    setResolving(false);
    sessionTokenRef.current = createSessionToken();
    if (result.ok) {
      onSelect(result);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder={placeholder || 'Search for an address'}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-neutral-800 bg-neutral-950 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {(loading || resolving) && (
          <Loader2 className="w-4 h-4 text-neutral-500 absolute right-4 top-1/2 -translate-y-1/2 animate-spin" />
        )}
      </div>
      {predictions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-neutral-950 border border-neutral-800 rounded-lg max-h-52 overflow-y-auto shadow-2xl">
          {predictions.map((p) => (
            <button
              key={p.placeId}
              type="button"
              onClick={() => handleSelect(p)}
              className="w-full text-left px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-900 border-b border-neutral-900 last:border-b-0"
            >
              {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

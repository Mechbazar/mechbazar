import React, { useRef, useState } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, Typography, geocodeService, createSessionToken } from '@mechbazar/shared';
import type { GeocodeSuccess, AutocompletePrediction } from '@mechbazar/shared';

interface PlaceAutocompleteFieldProps {
  onSelect: (result: GeocodeSuccess) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 350;
const MIN_CHARS = 3;

// Cross-platform (no .native/.web split needed) -- just a text input plus a
// dropdown list, backed by the shared package's geocodeService (which proxies
// through the backend's /api/geocode/* routes). Mirrors
// apps/mobile/src/components/shared/PlaceAutocompleteField.tsx.
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
      const result = await geocodeService.autocomplete(input.trim(), { sessionToken: sessionTokenRef.current, country: 'in' });
      setLoading(false);
      setPredictions(result.ok ? result.predictions : []);
    }, DEBOUNCE_MS);
  };

  const handleSelect = async (prediction: AutocompletePrediction) => {
    setPredictions([]);
    setQuery(prediction.description);
    setResolving(true);
    const result = await geocodeService.placeDetails(prediction.placeId, { sessionToken: sessionTokenRef.current });
    setResolving(false);
    sessionTokenRef.current = createSessionToken();
    if (result.ok) {
      onSelect(result);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={search}
          placeholder={placeholder || 'Search for your store address'}
          placeholderTextColor={colors.textSecondary}
        />
        {(loading || resolving) && <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />}
      </View>
      {predictions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.predictionRow} onPress={() => handleSelect(item)}>
                <Typography variant="caption" numberOfLines={2}>{item.description}</Typography>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  spinner: { position: 'absolute', right: 12 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
    marginTop: 4,
    zIndex: 20,
    elevation: 6,
  },
  predictionRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
});

import React, { useRef, useState } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../../theme/tokens';
import {
  autocomplete,
  placeDetails,
  createSessionToken,
  GeocodeSuccess,
  AutocompletePrediction,
} from '../../services/geocode.service';

interface PlaceAutocompleteFieldProps {
  token: string;
  onSelect: (result: GeocodeSuccess) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 350;
const MIN_CHARS = 3;

// Cross-platform (no .native/.web split needed) -- just a text input plus a
// dropdown list, backed by the backend's /api/geocode/autocomplete and
// /api/geocode/place/:placeId proxies (see services/geocode.service.ts).
export default function PlaceAutocompleteField({ token, onSelect, placeholder }: PlaceAutocompleteFieldProps) {
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
      const result = await autocomplete(token, input.trim(), { sessionToken: sessionTokenRef.current, country: 'in' });
      setLoading(false);
      setPredictions(result.ok ? result.predictions : []);
    }, DEBOUNCE_MS);
  };

  const handleSelect = async (prediction: AutocompletePrediction) => {
    setPredictions([]);
    setQuery(prediction.description);
    setResolving(true);
    const result = await placeDetails(token, prediction.placeId, { sessionToken: sessionTokenRef.current });
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
          placeholder={placeholder || 'Search for an address'}
          placeholderTextColor={colors.textMuted}
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
                <Text style={styles.predictionText} numberOfLines={2}>
                  {item.description}
                </Text>
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
    borderColor: colors.borderLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textDark,
  },
  spinner: { position: 'absolute', right: 12 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    maxHeight: 200,
    marginTop: 4,
    zIndex: 20,
    elevation: 6,
  },
  predictionRow: { paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  predictionText: { fontSize: 13, color: colors.textDark },
});

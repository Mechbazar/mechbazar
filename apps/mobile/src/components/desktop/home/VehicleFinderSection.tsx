import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { fetchMyVehicles } from '../../../services/garage.service';
import { UserVehicle } from '../../../types/product';
import { colors, spacing, radius } from '../../../theme/tokens';
import VehicleFinder from '../catalog/VehicleFinder';

// Homepage-level wrapper around the same VehicleFinder component
// CategoryProductsDesktop already uses for its in-page vehicle filter --
// here it's a launch pad into an unfiltered, vehicle-scoped result set
// (categoryName: 'Search Results', the same sentinel the product rails'
// "View All" links already use to mean "no category filter"). "Use My
// Garage" reuses fetchMyVehicles(token), the same call GarageServicesSection
// makes -- no new vehicle storage, no new endpoints.
export default function VehicleFinderSection() {
  const navigation = useNavigation<NavigationProp<any>>();
  const token = useSelector((state: RootState) => state.auth.token);
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);

  useEffect(() => {
    if (!token) { setVehicles([]); return; }
    let cancelled = false;
    fetchMyVehicles(token).then(vs => { if (!cancelled) setVehicles(vs); }).catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const goToResults = (brandName?: string, modelName?: string, year?: string) => {
    navigation.navigate('CategoryProducts', {
      categoryName: 'Search Results',
      brandId: brandName,
      modelId: modelName,
      year,
    });
  };

  return (
    <View>
      <View style={styles.copy}>
        <Text style={styles.title}>Find Parts for Your Vehicle</Text>
        <Text style={styles.subtitle}>Select your vehicle to discover compatible parts.</Text>
      </View>

      {vehicles.length > 0 && (
        <View style={styles.garageRow}>
          <Text style={styles.garageLabel}>Use My Garage</Text>
          {vehicles.slice(0, 4).map(v => (
            <Pressable
              key={v.id}
              style={({ hovered }: any) => [styles.garagePill, hovered && styles.garagePillHovered]}
              onPress={() => goToResults(v.brand, v.model, v.year || undefined)}
            >
              <Ionicons name="car-sport" size={14} color={colors.primary} />
              <Text style={styles.garagePillText} numberOfLines={1}>
                {v.nickname || `${v.brand} ${v.model}`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <VehicleFinder
        hasActiveSelection={false}
        onClear={() => {}}
        onFind={({ brandName, modelName, year }) => goToResults(brandName, modelName, year)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textMuted },
  garageRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  garageLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginRight: 4 },
  garagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  garagePillHovered: { borderColor: colors.primary },
  garagePillText: { fontSize: 13, fontWeight: '600', color: colors.textDark, maxWidth: 160 },
});

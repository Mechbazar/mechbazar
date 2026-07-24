import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { fetchServiceCategories } from '../../../services/service.service';
import { fetchMyVehicles } from '../../../services/garage.service';
import { ServiceCategory } from '../../../types/service';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

// Previously a fixed 4-card list where two of the four ("Breakdown
// Assistance", "Video Consultation") triggered a hardcoded Alert.alert
// flow with no real backend behind it -- a dead end dressed up as a
// working feature. Replaced with real ServiceCategory rows fetched from
// the same endpoint the Services module's own home screen uses
// (fetchServiceCategories), so every card here opens a real, bookable
// category. "Video Consultation" is dropped entirely -- there is no
// backend concept for it anywhere in this codebase.
export function MechanicServicesSection() {
  const navigation = useNavigation<NavigationProp<any>>();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchServiceCategories(vehicleType).then(cats => {
      if (cancelled || !cats) return;
      // Emergency categories (e.g. "Emergency Breakdown Assistance") float to
      // the front of the homepage strip since they're the most time-critical.
      const sorted = [...cats].sort((a, b) => Number(b.isEmergency) - Number(a.isEmergency));
      setCategories(sorted.slice(0, 4));
    });
    return () => { cancelled = true; };
  }, [vehicleType]);

  if (categories.length === 0) return null;

  return (
    <View style={styles.grid}>
      {categories.map(cat => (
        <Pressable
          key={cat.id}
          style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
          onPress={() => navigation.navigate('ServiceCategory', { categoryId: cat.id, categoryName: cat.name })}
        >
          <View style={[styles.iconCircle, cat.isEmergency ? styles.iconCircleEmergency : styles.iconCircleDefault]}>
            {cat.icon ? <Text style={styles.iconEmoji}>{cat.icon}</Text> : <Ionicons name="build" size={26} color={colors.primary} />}
          </View>
          <Text style={styles.title}>{cat.name}</Text>
          {cat.description ? <Text style={styles.desc} numberOfLines={2}>{cat.description}</Text> : null}
          {cat.isEmergency && <Text style={styles.emergencyBadge}>24x7 EMERGENCY</Text>}
        </Pressable>
      ))}
    </View>
  );
}

// Promotes the real Vehicle Garage feature (add/manage vehicles, see
// vehicle-specific compatible parts) rather than a "Garage Tools" concept
// that has no backend model anywhere in this codebase.
export function GarageServicesSection() {
  const navigation = useNavigation<NavigationProp<any>>();
  const token = useSelector((state: RootState) => state.auth.token);
  const [vehicleCount, setVehicleCount] = useState(0);

  useEffect(() => {
    if (!token) { setVehicleCount(0); return; }
    let cancelled = false;
    fetchMyVehicles(token).then(vs => { if (!cancelled) setVehicleCount(vs.length); }).catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const CARDS = [
    {
      icon: 'car-sport' as const, iconBg: '#EBFBEE', iconColor: '#2B8A3E',
      title: vehicleCount > 0 ? 'My Garage' : 'Add Your Vehicle',
      desc: vehicleCount > 0
        ? `${vehicleCount} vehicle${vehicleCount > 1 ? 's' : ''} saved — manage them here`
        : 'Save your car or bike for faster checkout and compatible-parts filtering',
      onPress: () => navigation.navigate('Garage'),
    },
    {
      icon: 'search' as const, iconBg: '#E8F7FF', iconColor: '#1C7ED6',
      title: 'Find Compatible Parts',
      desc: 'Browse categories and filter by your saved vehicle',
      onPress: () => navigation.navigate('MainTabs', { screen: 'Categories' }),
    },
  ];

  return (
    <View style={styles.grid}>
      {CARDS.map(item => (
        <Pressable
          key={item.title}
          style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
          onPress={item.onPress}
        >
          <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
            <Ionicons name={item.icon} size={26} color={item.iconColor} />
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.desc}>{item.desc}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
  },
  cardHovered: { ...shadows.md, borderColor: colors.primary },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  iconCircleDefault: { backgroundColor: '#EBFBEE' },
  iconCircleEmergency: { backgroundColor: '#FFF0F0' },
  iconEmoji: { fontSize: 24 },
  title: { fontSize: 16, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  desc: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  emergencyBadge: { marginTop: 6, fontSize: 10, fontWeight: '800', color: colors.danger, letterSpacing: 0.5 },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

// Compact "what is MechBazar" strip right below the hero. All four routes
// are ones the rest of this page (and HomeScreenMobile's own quick actions)
// already navigate to -- Services doubles as the emergency entry point, same
// precedent as HomeScreenMobile's handleEmergencyBreakdown -- so this adds
// no new screens and no new fetches.
const ACTIONS: {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
  title: string;
  desc: string;
  navigate: (nav: NavigationProp<any>) => void;
}[] = [
  {
    key: 'shop', icon: 'cube-outline', tint: '#FFF0EF', iconColor: colors.primary,
    title: 'Shop Auto Parts', desc: 'Find parts for your vehicle',
    navigate: (nav) => nav.navigate('MainTabs', { screen: 'Categories' }),
  },
  {
    key: 'book', icon: 'build-outline', tint: '#E8F7FF', iconColor: '#1C7ED6',
    title: 'Book a Mechanic', desc: 'Get professional vehicle service',
    navigate: (nav) => nav.navigate('Services'),
  },
  {
    key: 'garage', icon: 'car-sport-outline', tint: '#EBFBEE', iconColor: '#2B8A3E',
    title: 'My Garage', desc: 'Manage vehicles & find compatible parts',
    navigate: (nav) => nav.navigate('Garage'),
  },
  {
    key: 'emergency', icon: 'flash-outline', tint: '#FFF0F0', iconColor: colors.danger,
    title: 'Emergency Assistance', desc: '24x7 roadside breakdown help',
    navigate: (nav) => nav.navigate('Services'),
  },
];

export default function QuickActions() {
  const navigation = useNavigation<NavigationProp<any>>();
  return (
    <View style={styles.grid}>
      {ACTIONS.map(action => (
        <Pressable
          key={action.key}
          style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
          onPress={() => action.navigate(navigation)}
          accessibilityRole="button"
          accessibilityLabel={action.title}
        >
          <View style={[styles.iconCircle, { backgroundColor: action.tint }]}>
            <Ionicons name={action.icon} size={22} color={action.iconColor} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>{action.title}</Text>
            <Text style={styles.desc} numberOfLines={1}>{action.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  cardHovered: { ...shadows.md, borderColor: colors.primary },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 2 },
  desc: { fontSize: 12, color: colors.textMuted },
});

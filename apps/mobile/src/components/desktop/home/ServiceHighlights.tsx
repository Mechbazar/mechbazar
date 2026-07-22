import React from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

// Same four actions the mobile Home screen's "Quick Actions" row already
// exposes (Home Mechanic / Video Call / Breakdown / Garage Tools) -- same
// navigation targets and the same Alert-based flows for the two that don't
// have a dedicated screen yet, just presented as a desktop highlight strip.
const HIGHLIGHTS: {
  icon: keyof typeof Ionicons.glyphMap; iconBg: string; iconColor: string;
  title: string; desc: string; action: (nav: NavigationProp<any>) => void;
}[] = [
  {
    icon: 'build', iconBg: '#EBFBEE', iconColor: '#2B8A3E',
    title: 'Home Mechanic', desc: 'Book a verified mechanic at your doorstep',
    action: nav => nav.navigate('MainTabs', { screen: 'Services' }),
  },
  {
    icon: 'flash', iconBg: '#FFF9DB', iconColor: '#F59F00',
    title: 'Breakdown Assistance', desc: '24x7 emergency roadside dispatch',
    action: () => Alert.alert(
      'Emergency Roadside Help',
      'Need immediate breakdown dispatch? A local service technician will be directed to your current location.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Call Dispatcher', style: 'destructive', onPress: () => Alert.alert('Request Sent', 'A verification agent is calling you back in 60 seconds.') }],
    ),
  },
  {
    icon: 'videocam', iconBg: '#E8F7FF', iconColor: '#1C7ED6',
    title: 'Video Consultation', desc: 'Diagnose issues live with an expert',
    action: () => Alert.alert('Video Consultation', 'Connecting with a live consulting technician...'),
  },
  {
    icon: 'construct', iconBg: '#F8F0FC', iconColor: '#9C36B5',
    title: 'Garage Tools', desc: 'Rent or buy professional-grade tools',
    action: nav => nav.navigate('MainTabs', { screen: 'Services' }),
  },
];

export default function ServiceHighlights() {
  const navigation = useNavigation<NavigationProp<any>>();

  return (
    <View style={styles.grid}>
      {HIGHLIGHTS.map(item => (
        <Pressable
          key={item.title}
          style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
          onPress={() => item.action(navigation)}
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
  title: { fontSize: 16, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  desc: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});

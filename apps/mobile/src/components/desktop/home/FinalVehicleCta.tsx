import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { colors, spacing, radius } from '../../../theme/tokens';

// Closing conversion band. Both buttons reuse routes already navigated to
// elsewhere on this page (QuickActions/Hero/GarageServicesSection) -- no new
// screens.
export default function FinalVehicleCta() {
  const navigation = useNavigation<NavigationProp<any>>();
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Your Vehicle. One Place.</Text>
      <Text style={styles.subtitle}>Buy the right parts. Book the right service. Keep your vehicle running.</Text>
      <View style={styles.actions}>
        <Pressable
          style={({ hovered }: any) => [styles.btn, styles.btnPrimary, hovered && styles.btnPrimaryHovered]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Categories' })}
        >
          <Text style={styles.btnPrimaryText}>Shop Parts</Text>
        </Pressable>
        <Pressable
          style={({ hovered }: any) => [styles.btn, styles.btnSecondary, hovered && styles.btnSecondaryHovered]}
          onPress={() => navigation.navigate('Services')}
        >
          <Text style={styles.btnSecondaryText}>Book a Service</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    backgroundColor: colors.steel,
    borderRadius: radius.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  title: { color: colors.white, fontSize: 28, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center', marginBottom: spacing.lg, maxWidth: 480 },
  actions: { flexDirection: 'row', gap: spacing.md },
  btn: { paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radius.md },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryHovered: { backgroundColor: colors.primaryDark },
  btnPrimaryText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  btnSecondaryHovered: { borderColor: colors.white },
  btnSecondaryText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});

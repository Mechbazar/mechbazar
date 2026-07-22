import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { fetchMyAddresses } from '../../../services/address.service';
import { colors, spacing } from '../../../theme/tokens';

// Reads the existing saved-addresses API (already backing AddressManagementScreen)
// purely for display -- no new endpoint. Clicking through opens that same
// existing screen rather than a new location picker.
export default function LocationSelector() {
  const navigation = useNavigation<NavigationProp<any>>();
  const token = useSelector((state: RootState) => state.auth.token);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLabel(null);
      return;
    }
    let cancelled = false;
    fetchMyAddresses(token).then(addresses => {
      if (cancelled) return;
      const primary = addresses.find(a => a.isDefault) || addresses[0];
      setLabel(primary ? `${primary.city}, ${primary.pincode}` : null);
    });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <TouchableOpacity
      style={styles.wrapper}
      onPress={() => navigation.navigate(token ? 'AddressManagement' : 'Welcome')}
      accessibilityRole="button"
      accessibilityLabel="Delivery location"
    >
      <Ionicons name="location-outline" size={18} color={colors.white} />
      <Text style={styles.text} numberOfLines={1}>
        {label ? `Deliver to ${label}` : 'Select location'}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    maxWidth: 200,
  },
  text: { color: colors.white, fontSize: 13, fontWeight: '600' },
});

import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, Typography } from '@mechbazar/shared';
import { Layers, Store, Users, Navigation, Car, Tag, Image, CreditCard, Warehouse, Settings, ChevronRight, Wrench, ClipboardList, Clock3, Package, Bell, Bike } from 'lucide-react-native';

const MENU = [
  { label: 'Notifications', screen: 'Notifications', icon: Bell },
  { label: 'Categories', screen: 'Categories', icon: Layers },
  { label: 'Service Bookings', screen: 'ServiceBookings', icon: ClipboardList },
  { label: 'Service Categories', screen: 'ServiceCategories', icon: Layers },
  { label: 'Service Packages', screen: 'ServicePackages', icon: Package },
  { label: 'Service Time Slots', screen: 'ServiceTimeSlots', icon: Clock3 },
  { label: 'Technicians', screen: 'Technicians', icon: Wrench },
  { label: 'Vendors', screen: 'Vendors', icon: Store },
  { label: 'Customers', screen: 'Customers', icon: Users },
  { label: 'Riders', screen: 'Riders', icon: Navigation },
  { label: 'Vehicle Master', screen: 'VehicleMaster', icon: Car },
  { label: 'Coupons', screen: 'Coupons', icon: Tag },
  { label: 'Banners & CMS', screen: 'Banners', icon: Image },
  { label: 'Payouts (Vendor)', screen: 'Payouts', icon: CreditCard },
  { label: 'Payouts (Rider)', screen: 'RiderPayouts', icon: Bike },
  { label: 'Payouts (Technician)', screen: 'TechnicianPayouts', icon: Wrench },
  { label: 'Inventory', screen: 'Inventory', icon: Warehouse },
  { label: 'Settings', screen: 'Settings', icon: Settings },
] as const;

// Mobile equivalent of apps/admin's sidebar, condensed behind a menu-style
// tab — the same pattern the current admin-mobile placeholder copy
// ("Settings & More (Inventory, Vendors, etc.)") already anticipated.
// Service Categories/Technicians mirror the web sidebar's "Services" section
// (apps/admin/src/pages/services/index.tsx's Categories/Technicians tabs).
export const MoreScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Typography variant="h2" style={{ marginBottom: 16 }}>More</Typography>
      <View style={styles.list}>
        {MENU.map((item, idx) => (
          <TouchableOpacity
            key={item.screen}
            style={[styles.row, idx === MENU.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <item.icon color={colors.navy} size={20} />
              <Typography variant="body">{item.label}</Typography>
            </View>
            <ChevronRight color={colors.textSecondary} size={18} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
});

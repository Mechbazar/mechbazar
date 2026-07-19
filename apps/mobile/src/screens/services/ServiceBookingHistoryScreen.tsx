import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ServiceBooking, BookingStatus } from '../../types/service';
import { fetchMyBookings } from '../../services/service.service';
import { HeaderCartButton } from '../../components/HeaderCartButton';
import { colors } from './theme';

const STATUS_COLORS: Partial<Record<BookingStatus, { bg: string; border: string; text: string }>> = {
  COMPLETED: { bg: '#F0FDF4', border: colors.success, text: colors.success },
  CANCELLED: { bg: '#FEF2F2', border: colors.danger, text: colors.danger },
  REJECTED: { bg: '#FEF2F2', border: colors.danger, text: colors.danger },
  MECHANIC_ASSIGNED: { bg: '#FFF8E1', border: colors.warning, text: colors.warning },
  MECHANIC_ACCEPTED: { bg: '#FFF8E1', border: colors.warning, text: colors.warning },
};

export default function ServiceBookingHistoryScreen() {
  const navigation = useNavigation<any>();
  const { token } = useSelector((state: RootState) => state.auth);

  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const data = await fetchMyBookings(token);
    setBookings(data);
    setLoading(false);
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerSubtitle}>Service history and active jobs</Text>
      </View>
      <HeaderCartButton color="#FFFFFF" backgroundColor="rgba(255,255,255,0.15)" />
    </View>
  );

  const rebook = (b: ServiceBooking) => {
    navigation.navigate('ServiceBooking', { packageId: b.packageId, categoryId: b.categoryId });
  };

  const renderBooking = ({ item }: { item: ServiceBooking }) => {
    const badge = STATUS_COLORS[item.status] || { bg: colors.pageBg, border: colors.borderLight, text: colors.textMuted };
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ServiceTracking', { bookingId: item.id })}>
        <View style={styles.cardHeader}>
          <Text style={styles.bookingId}>#{item.bookingNumber}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <Text style={styles.serviceName}>{item.package?.name || 'Service'}</Text>
        <Text style={styles.meta}>{item.vehicleBrand} {item.vehicleModel} · {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.amount}>₹{item.finalAmount}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {item.status === 'COMPLETED' && (
              <TouchableOpacity style={styles.actionBtnOutline} onPress={() => rebook(item)}>
                <Text style={styles.actionBtnOutlineText}>Rebook</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ServiceTracking', { bookingId: item.id })}>
              <Text style={styles.actionBtnText}>{item.status === 'COMPLETED' ? 'View' : 'Track'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛠️</Text>
          <Text style={styles.emptyTitle}>No service bookings yet</Text>
          <Text style={styles.emptySubtitle}>Book a doorstep service and it'll show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  headerSubtitle: { fontSize: 13, color: '#9AA5B1', marginTop: 2 },

  listContent: { padding: 14 },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bookingId: { fontSize: 14, fontWeight: '900', color: colors.textDark },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  serviceName: { fontSize: 15, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 16, fontWeight: '900', color: colors.textDark },
  actionBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: colors.white, fontSize: 12, fontWeight: 'bold' },
  actionBtnOutline: { borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnOutlineText: { color: colors.primary, fontSize: 12, fontWeight: 'bold' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});

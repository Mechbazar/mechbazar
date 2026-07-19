import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { RootState } from '../../store';
import { ServiceInvoice, ServiceBooking } from '../../types/service';
import { fetchBookingInvoice, fetchBookingById } from '../../services/service.service';
import { colors } from './theme';

type ParamList = { ServiceInvoice: { bookingId: string } };

const invoiceHtml = (invoice: ServiceInvoice, booking: ServiceBooking | null) => `
  <html>
    <body style="font-family: -apple-system, sans-serif; padding: 24px; color: #161B21;">
      <h1 style="color: #E23B22; margin-bottom: 4px;">MechBazar</h1>
      <p style="color: #6B7480; margin-top: 0;">Doorstep Service Invoice</p>
      <hr style="border: none; border-top: 1px solid #E3E6EA; margin: 16px 0;" />
      <p><strong>Invoice No:</strong> ${invoice.invoiceNumber}</p>
      <p><strong>Booking No:</strong> ${booking?.bookingNumber || ''}</p>
      <p><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
      <p><strong>Service:</strong> ${booking?.package?.name || ''}</p>
      <p><strong>Vehicle:</strong> ${booking?.vehicleBrand || ''} ${booking?.vehicleModel || ''}</p>
      <hr style="border: none; border-top: 1px solid #E3E6EA; margin: 16px 0;" />
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0;">Subtotal</td><td style="text-align: right;">₹${invoice.subtotal}</td></tr>
        <tr><td style="padding: 6px 0;">Additional Work</td><td style="text-align: right;">₹${invoice.additionalCost}</td></tr>
        <tr><td style="padding: 6px 0;">Discount</td><td style="text-align: right;">-₹${invoice.discountAmount}</td></tr>
        <tr><td style="padding: 6px 0;">Tax</td><td style="text-align: right;">₹${invoice.taxAmount}</td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #E3E6EA; margin: 16px 0;" />
      <h2 style="display: flex; justify-content: space-between;">Total: ₹${invoice.totalAmount}</h2>
      <p style="color: #6B7480; font-size: 12px; margin-top: 32px;">Thank you for choosing MechBazar doorstep service.</p>
    </body>
  </html>
`;

export default function ServiceInvoiceScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ServiceInvoice'>>();
  const { bookingId } = route.params;
  const { token } = useSelector((state: RootState) => state.auth);

  const [invoice, setInvoice] = useState<ServiceInvoice | null>(null);
  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchBookingInvoice(token, bookingId), fetchBookingById(token, bookingId)]).then(([inv, b]) => {
      setInvoice(inv);
      setBooking(b);
      setLoading(false);
    });
  }, [token, bookingId]);

  const handleShare = async () => {
    if (!invoice) return;
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: invoiceHtml(invoice, booking) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoice.invoiceNumber}` });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to generate invoice PDF.');
    } finally {
      setSharing(false);
    }
  };

  if (loading || !invoice) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.invoiceCard}>
          <Text style={styles.brand}>MechBazar</Text>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          <Text style={styles.invoiceDate}>{new Date(invoice.createdAt).toLocaleDateString()}</Text>

          <View style={styles.divider} />

          <View style={styles.row}><Text style={styles.label}>Service</Text><Text style={styles.value}>{booking?.package?.name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Booking No.</Text><Text style={styles.value}>#{booking?.bookingNumber}</Text></View>

          <View style={styles.divider} />

          <View style={styles.row}><Text style={styles.label}>Subtotal</Text><Text style={styles.value}>₹{invoice.subtotal}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Additional Work</Text><Text style={styles.value}>₹{invoice.additionalCost}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Discount</Text><Text style={styles.value}>-₹{invoice.discountAmount}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Tax</Text><Text style={styles.value}>₹{invoice.taxAmount}</Text></View>

          <View style={styles.dashedDivider} />

          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{invoice.totalAmount}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
          <Text style={styles.shareBtnText}>{sharing ? 'Preparing PDF...' : '⬇ Download / Share Invoice'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },

  invoiceCard: { backgroundColor: colors.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.borderLight },
  brand: { fontSize: 20, fontWeight: '900', color: colors.primary },
  invoiceNumber: { fontSize: 13, color: colors.textDark, fontWeight: '700', marginTop: 6 },
  invoiceDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },
  dashedDivider: { height: 1, borderColor: colors.borderLight, borderWidth: 1, borderStyle: 'dashed', marginVertical: 16 },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 13, color: colors.textMuted },
  value: { fontSize: 13, color: colors.textDark, fontWeight: '700' },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  totalValue: { fontSize: 18, fontWeight: '900', color: colors.textDark },

  shareBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  shareBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});

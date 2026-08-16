import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Logo, logoSvgMarkup } from '@mechbazar/shared';
import { notify } from '../utils/notify';
import { useStableIsDesktopUp } from '../hooks/useStableIsDesktopUp';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

type ParamList = { OrderInvoice: { order: any } };

// Local copy of the shared services/theme.ts palette (that file is used by
// other, unconverted screens under screens/services -- not touched here).
// `darkInk` is used ONLY as this screen's permanently-dark header bar
// background, so it's kept fixed instead of flipping like `textDark` does.
// `white` is split: `white` stays fixed FFFFFF (icon/text on the fixed dark
// header + text on the red share button), while the NEW `surface` key
// carries the invoice card + download-button backgrounds that actually
// invert (previously both roles shared `colors.white`).
const LIGHT_COLORS = {
  primary: '#DA3830',
  darkInk: '#1B1B1B',
  steel: '#242C35',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  accent: '#2ECC71',
  success: '#1E9E5A',
  warning: '#F5A300',
  danger: '#D32F2F',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  darkInk: '#1B1B1B',
  steel: '#242C35',
  pageBg: '#121212',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  accent: '#2ECC71',
  success: '#4FE092',
  warning: '#F5B94D',
  danger: '#FF6B6B',
};

const invoiceHtml = (order: any, shortId: string) => `
  <html>
    <body style="font-family: -apple-system, sans-serif; padding: 24px; color: #1B1B1B;">
      <div style="margin-bottom: 4px;">${logoSvgMarkup({ width: 180 })}</div>
      <p style="color: #6B7480; margin-top: 0;">Order Invoice</p>
      <hr style="border: none; border-top: 1px solid #E3E6EA; margin: 16px 0;" />
      <p><strong>Order No:</strong> ${shortId}</p>
      <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
      ${order.payment ? `<p><strong>Payment:</strong> ${order.payment.method} (${order.payment.status})</p>` : ''}
      ${order.address ? `<p><strong>Deliver to:</strong> ${order.address.line1}, ${order.address.city} ${order.address.pincode}</p>` : ''}
      <hr style="border: none; border-top: 1px solid #E3E6EA; margin: 16px 0;" />
      <table style="width: 100%; border-collapse: collapse;">
        ${(order.items || []).map((oi: any) => `
          <tr>
            <td style="padding: 6px 0;">${oi.product?.name || 'Item'} × ${oi.quantity}</td>
            <td style="text-align: right;">₹${oi.price * oi.quantity}</td>
          </tr>
        `).join('')}
      </table>
      <hr style="border: none; border-top: 1px solid #E3E6EA; margin: 16px 0;" />
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0;">Subtotal</td><td style="text-align: right;">₹${order.totalAmount}</td></tr>
        ${order.discountAmount ? `<tr><td style="padding: 6px 0;">Discount</td><td style="text-align: right;">-₹${order.discountAmount}</td></tr>` : ''}
        <tr><td style="padding: 6px 0;">Delivery</td><td style="text-align: right;">₹${order.deliveryFee ?? 0}</td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #E3E6EA; margin: 16px 0;" />
      <h2>Total: ₹${order.finalAmount}</h2>
      <p style="color: #6B7480; font-size: 12px; margin-top: 32px;">Thank you for shopping with MechBazar.</p>
    </body>
  </html>
`;

export default function OrderInvoiceScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'OrderInvoice'>>();
  const { t } = useTranslation();
  const { order } = route.params;
  const shortId = order.id.split('-')[0].toUpperCase();

  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isDesktopUp = useStableIsDesktopUp();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  // printToFileAsync's own temp file lives in a location that's readable
  // neither by expo-sharing's FileProvider nor by expo-file-system's own
  // copyAsync inside Expo Go ("Not allowed to read file under given URL" /
  // "isn't readable") -- requesting base64 output sidesteps needing to read
  // that file cross-module at all; we just write the bytes ourselves.
  const generatePdf = async () => {
    const { base64 } = await Print.printToFileAsync({ html: invoiceHtml(order, shortId), base64: true });
    const dest = `${FileSystem.cacheDirectory}invoice-${shortId}.pdf`;
    await FileSystem.writeAsStringAsync(dest, base64!, { encoding: FileSystem.EncodingType.Base64 });
    return { dest, base64: base64! };
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const { dest } = await generatePdf();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: `Invoice ${shortId}` });
      } else {
        notify('Sharing not available', 'Sharing is not supported on this device.');
      }
    } catch (err) {
      console.error('Failed to share invoice PDF:', err);
      notify('Error', 'Failed to generate invoice PDF.');
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { dest, base64 } = await generatePdf();

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          setDownloading(false);
          return;
        }
        const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          `invoice-${shortId}.pdf`,
          'application/pdf'
        );
        await FileSystem.writeAsStringAsync(targetUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        notify('Downloaded', 'Invoice saved successfully.');
      } else {
        // iOS has no direct "save to Downloads" API for arbitrary files -- the
        // share sheet's "Save to Files" option is the closest equivalent.
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: `Invoice ${shortId}` });
        } else {
          notify('Downloading not available', 'Downloading is not supported on this device.');
        }
      }
    } catch (err) {
      console.error('Failed to download invoice PDF:', err);
      notify('Error', 'Failed to generate invoice PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('orderInvoice.invoice')}</Text>
      </View>

      <CompactBookingShell maxWidth={640} style={styles.flexFill}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.invoiceCard}>
          <Logo width={170} />
          <Text style={styles.invoiceNumber}>{t('orderInvoice.orderNumber', { shortId })}</Text>
          <Text style={styles.invoiceDate}>{new Date(order.createdAt).toLocaleDateString()}</Text>

          <View style={styles.divider} />

          {(order.items || []).map((oi: any) => (
            <View key={oi.id} style={styles.row}>
              <Text style={styles.label} numberOfLines={1}>{oi.product?.name || t('orderHistory.item')} × {oi.quantity}</Text>
              <Text style={styles.value}>₹{oi.price * oi.quantity}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.row}><Text style={styles.label}>{t('orderHistory.subtotal')}</Text><Text style={styles.value}>₹{order.totalAmount}</Text></View>
          {!!order.discountAmount && (
            <View style={styles.row}><Text style={styles.label}>{t('orderHistory.discount')}</Text><Text style={styles.value}>-₹{order.discountAmount}</Text></View>
          )}
          <View style={styles.row}><Text style={styles.label}>{t('orderHistory.delivery')}</Text><Text style={styles.value}>₹{order.deliveryFee ?? 0}</Text></View>
          {order.payment && (
            <View style={styles.row}><Text style={styles.label}>{t('orderInvoice.payment')}</Text><Text style={styles.value}>{order.payment.method} ({order.payment.status})</Text></View>
          )}
          {order.address && (
            <Text style={styles.address}>📍 {order.address.line1}, {order.address.city} {order.address.pincode}</Text>
          )}

          <View style={styles.dashedDivider} />

          <View style={styles.row}>
            <Text style={styles.totalLabel}>{t('orderHistory.total')}</Text>
            <Text style={styles.totalValue}>₹{order.finalAmount}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.downloadBtn]} onPress={handleDownload} disabled={downloading}>
            <Text style={[styles.actionBtnText, styles.downloadBtnText]}>{downloading ? t('orderInvoice.saving') : t('orderInvoice.download')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare} disabled={sharing}>
            <Text style={styles.actionBtnText}>{sharing ? t('orderInvoice.preparing') : t('orderInvoice.share')}</Text>
          </TouchableOpacity>
        </View>
        <MinimalFooter />
      </ScrollView>
      </CompactBookingShell>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  // Permanently-dark branded header bar -- background and the white text/icon
  // on it stay fixed literals so nothing flips out of sync (colors.darkInk is
  // itself pinned fixed above for the same reason).
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },

  invoiceCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.borderLight },
  invoiceNumber: { fontSize: 13, color: colors.textDark, fontWeight: '700', marginTop: 6 },
  invoiceDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },
  dashedDivider: { height: 1, borderColor: colors.borderLight, borderWidth: 1, borderStyle: 'dashed', marginVertical: 16 },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 13, color: colors.textMuted, flex: 1, marginRight: 8 },
  value: { fontSize: 13, color: colors.textDark, fontWeight: '700' },
  address: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 4 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  totalValue: { fontSize: 18, fontWeight: '900', color: colors.textDark },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  downloadBtn: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  shareBtn: { backgroundColor: colors.primary },
  actionBtnText: { fontWeight: '800', fontSize: 14, color: colors.white },
  downloadBtnText: { color: colors.primary },
});

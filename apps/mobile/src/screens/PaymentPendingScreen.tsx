import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { getOrderById } from '../services/order.service';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

type ParamList = { PaymentPending: { orderId: string } };

// Local copy of the (subset of the) shared services/theme.ts palette used by
// this screen -- see PaymentSuccessScreen.tsx for the same note. No
// full-bleed colored background here; `white` stays fixed (unused directly
// in styles but kept for parity with the other Payment* screens' shape).
const LIGHT_COLORS = {
  primary: '#DA3830',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  pageBg: '#121212',
  white: '#FFFFFF',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
};

// Shown right after the checkout sheet closes but before Razorpay's webhook
// has confirmed the payment. Polls the order once after a short delay --
// this is a convenience check, not the source of truth (the webhook is,
// see backend/src/controllers/payment.controller.ts).
export default function PaymentPendingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'PaymentPending'>>();
  const { t } = useTranslation();
  const { orderId } = route.params;
  const shortId = orderId.split('-')[0].toUpperCase();
  const { token } = useSelector((state: RootState) => state.auth);
  const [checking, setChecking] = useState(false);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(async () => {
      setChecking(true);
      const result = await getOrderById(token, orderId);
      setChecking(false);
      const paymentStatus = result.order?.payment?.status;
      if (paymentStatus === 'SUCCESS') {
        navigation.replace('PaymentSuccess', { orderId, amount: result.order.finalAmount });
      } else if (paymentStatus === 'FAILED') {
        navigation.replace('PaymentFailure', { orderId });
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [token, orderId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>⏳</Text>
        <Text style={styles.title}>{t('payment.pending.title')}</Text>
        <Text style={styles.subtitle}>
          {t('payment.pending.subtitle', { shortId })}
        </Text>
        {checking && <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 20 }} />}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })}
        >
          <Text style={styles.primaryBtnText}>{t('payment.success.viewMyOrders')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { fontSize: 72, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.textDark, marginBottom: 10 },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: colors.white, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
});

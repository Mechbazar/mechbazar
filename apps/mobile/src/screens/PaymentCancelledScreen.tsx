import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { openRazorpayCheckout, verifyRazorpayPayment } from '../services/payment.service';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

// Local copy of the (subset of the) shared services/theme.ts palette used by
// this screen -- see PaymentSuccessScreen.tsx for the same note. No
// full-bleed colored background here; `white` stays fixed (retry button's
// spinner/label sit on the always-red primary button in both themes).
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

type ParamList = {
  PaymentCancelled: {
    orderId: string;
    amount: number;
    razorpayOrderId: string;
    razorpayKeyId: string;
  };
};

// Reached only when the customer actively dismissed the Razorpay checkout
// sheet without attempting a payment (see CartScreen.tsx's `cancelled`
// branch) -- distinct from PaymentFailureScreen (a payment was attempted and
// rejected) and PaymentPendingScreen (a payment was attempted and we're
// waiting on the webhook). The Order row already exists as PENDING/RAZORPAY;
// nothing here needs to touch the backend to fall back to COD, since a rider
// collects cash at the door for any order whose payment never reached
// SUCCESS -- see updateMyDeliveryStatus's paymentAlreadySettled check.
export default function PaymentCancelledScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'PaymentCancelled'>>();
  const { t } = useTranslation();
  const { orderId, amount, razorpayOrderId, razorpayKeyId } = route.params;
  const shortId = orderId.split('-')[0].toUpperCase();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const [retrying, setRetrying] = useState(false);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const result = await openRazorpayCheckout({
        razorpayOrderId,
        keyId: razorpayKeyId,
        amount,
        orderId,
        prefillPhone: user?.phone,
      });

      if (!result.success) {
        if (!result.cancelled) {
          navigation.replace('PaymentFailure', { orderId, reason: result.error });
        }
        // Still cancelled -- stay on this screen so the customer can retry again.
        return;
      }

      if (token) {
        const verification = await verifyRazorpayPayment(token, {
          razorpay_order_id: result.razorpay_order_id!,
          razorpay_payment_id: result.razorpay_payment_id!,
          razorpay_signature: result.razorpay_signature!,
        });
        if (verification.ok) {
          navigation.replace('PaymentSuccess', { orderId, amount });
          return;
        }
      }
      navigation.replace('PaymentPending', { orderId });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🚫</Text>
        <Text style={styles.title}>{t('payment.cancelled.title')}</Text>
        <Text style={styles.subtitle}>
          {t('payment.cancelled.subtitle', { shortId, amount })}
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleRetry} disabled={retrying}>
          {retrying ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>{t('payment.cancelled.retryOnlinePayment')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })}
        >
          <Text style={styles.secondaryBtnText}>{t('payment.cancelled.continueWithCod')}</Text>
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
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 12, minHeight: 48, justifyContent: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  secondaryBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10, width: '100%', alignItems: 'center' },
  secondaryBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});

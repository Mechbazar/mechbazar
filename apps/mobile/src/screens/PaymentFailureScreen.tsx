import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

type ParamList = { PaymentFailure: { orderId: string; reason?: string } };

// Local copy of the (subset of the) shared services/theme.ts palette used by
// this screen -- see PaymentSuccessScreen.tsx for the same note. No
// full-bleed colored background here; `white` stays fixed as the label on
// the always-red primary button, everything else inverts with the page.
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

export default function PaymentFailureScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'PaymentFailure'>>();
  const { t } = useTranslation();
  const { orderId, reason } = route.params;
  const shortId = orderId.split('-')[0].toUpperCase();
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>{t('payment.failure.title')}</Text>
        <Text style={styles.subtitle}>
          {t('payment.failure.subtitle', { reason: reason || t('payment.failure.defaultReason'), shortId })}
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })}
        >
          <Text style={styles.primaryBtnText}>{t('payment.failure.viewOrder')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('MainTabs')}>
          <Text style={styles.secondaryBtnText}>{t('payment.failure.backToHome')}</Text>
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
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: colors.white, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  secondaryBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10, width: '100%', alignItems: 'center' },
  secondaryBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});

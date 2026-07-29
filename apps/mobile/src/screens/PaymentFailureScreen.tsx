import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors } from './services/theme';

type ParamList = { PaymentFailure: { orderId: string; reason?: string } };

export default function PaymentFailureScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'PaymentFailure'>>();
  const { orderId, reason } = route.params;
  const shortId = orderId.split('-')[0].toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>Payment Failed</Text>
        <Text style={styles.subtitle}>
          {reason || 'Your payment could not be completed.'} Order #{shortId} was still placed and is awaiting
          payment -- you can pay via Cash on Delivery instead.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })}
        >
          <Text style={styles.primaryBtnText}>View Order</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('MainTabs')}>
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

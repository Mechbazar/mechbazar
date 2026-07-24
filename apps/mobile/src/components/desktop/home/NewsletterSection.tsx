import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../../theme/tokens';
import { subscribeToNewsletter } from '../../../services/newsletter.service';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const handleSubscribe = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    const result = await subscribeToNewsletter(email.trim());
    setStatus(result.ok ? 'success' : 'error');
    setMessage(result.message);
    if (result.ok) setEmail('');
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Stay in the Loop</Text>
        <Text style={styles.subtitle}>Get updates on new arrivals, deals, and service offers straight to your inbox.</Text>
      </View>

      <View style={styles.formCol}>
        <View style={styles.inputRow}>
          <TextInput
            value={email}
            onChangeText={t => { setEmail(t); if (status !== 'idle') setStatus('idle'); }}
            placeholder="you@example.com"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={status !== 'loading'}
          />
          <Pressable style={styles.button} onPress={handleSubscribe} disabled={status === 'loading' || !email.trim()}>
            {status === 'loading'
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={styles.buttonText}>Subscribe</Text>}
          </Pressable>
        </View>
        {status === 'success' && (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={[styles.statusText, { color: colors.accent }]}>{message}</Text>
          </View>
        )}
        {status === 'error' && (
          <View style={styles.statusRow}>
            <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
            <Text style={[styles.statusText, { color: '#FF6B6B' }]}>{message}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    backgroundColor: colors.darkInk,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  textBlock: { flexShrink: 1, minWidth: 260 },
  title: { color: colors.white, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20 },
  formCol: { minWidth: 320 },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    minWidth: 200,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 110,
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  statusText: { fontSize: 12, fontWeight: '600' },
});

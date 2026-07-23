import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { submitBookingReview } from '../../services/service.service';
import { colors } from './theme';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../../components/desktop/shared/MinimalFooter';

type ParamList = { ServiceReview: { bookingId: string } };

export default function ServiceReviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ServiceReview'>>();
  const { bookingId } = route.params;
  const { token } = useSelector((state: RootState) => state.auth);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { isDesktopUp } = useBreakpoint();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  const handleSubmit = async () => {
    if (rating === 0 || !token) return;
    setSubmitting(true);
    const res = await submitBookingReview(token, bookingId, rating, comment || undefined);
    setSubmitting(false);
    if (!res.ok) {
      Alert.alert('Error', res.error || 'Failed to submit review');
      return;
    }
    Alert.alert('Thank you!', 'Your review has been submitted.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate & Review</Text>
      </View>

      <CompactBookingShell maxWidth={560} style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.prompt}>How was your service experience?</Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Text style={[styles.star, star <= rating && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.textArea}
          placeholder="Tell us more about your experience (optional)..."
          placeholderTextColor={colors.textMuted}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitBtn, (rating === 0 || submitting) && styles.submitBtnDisabled]}
          disabled={rating === 0 || submitting}
          onPress={handleSubmit}
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Review'}</Text>
        </TouchableOpacity>
        <MinimalFooter />
      </ScrollView>
      </CompactBookingShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },

  content: { padding: 24 },
  prompt: { fontSize: 17, fontWeight: '800', color: colors.textDark, textAlign: 'center', marginBottom: 24 },

  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 28, gap: 8 },
  star: { fontSize: 40, color: colors.borderLight },
  starActive: { color: '#F5A300' },

  textArea: { backgroundColor: colors.white, borderRadius: 12, padding: 14, fontSize: 14, color: colors.textDark, borderWidth: 1, borderColor: colors.borderLight, minHeight: 120, marginBottom: 24 },

  submitBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#F0B2A5' },
  submitBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});

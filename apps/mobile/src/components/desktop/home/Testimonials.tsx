import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../../theme/tokens';

// PLACEHOLDER COPY: there is no reviews/testimonials API today, so these are
// illustrative quotes (no real customer names/photos attached) rather than
// claims of genuine reviews. Swap for real content once a testimonials
// endpoint exists.
const TESTIMONIALS = [
  { quote: 'Ordered brake pads in the evening, fitted by a mechanic the next morning. Genuinely simple.', role: 'Car owner, Delhi' },
  { quote: 'The home mechanic service saved me a trip to the garage for a battery replacement.', role: 'Bike owner, Pune' },
  { quote: 'Parts matched my exact model on the first try -- no guesswork needed.', role: 'Car owner, Bengaluru' },
];

export default function Testimonials() {
  return (
    <View style={styles.grid}>
      {TESTIMONIALS.map((t, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.starRow}>
            {Array.from({ length: 5 }).map((_, s) => (
              <Ionicons key={s} name="star" size={14} color="#F5A300" />
            ))}
          </View>
          <Text style={styles.quote}>&ldquo;{t.quote}&rdquo;</Text>
          <Text style={styles.role}>{t.role}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
  },
  starRow: { flexDirection: 'row', gap: 2, marginBottom: spacing.sm },
  quote: { fontSize: 14, color: colors.textDark, lineHeight: 21, marginBottom: spacing.sm },
  role: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});

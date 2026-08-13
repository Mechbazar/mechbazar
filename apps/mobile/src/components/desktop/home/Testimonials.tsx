import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../../theme/tokens';
import { API_BASE_URL } from '../../../services/api';

interface FeaturedReview {
  id: string;
  rating: number;
  comment: string;
  userName: string | null;
  productName: string;
}

interface Props {
  // The heading above this section lives in the parent (HomeScreenDesktop),
  // which has no way to know this component's fetch came back empty --
  // without this, "What Our Customers Say" rendered with nothing under it
  // (UX-03 fix). Fires once the fetch settles, true only when there's at
  // least one review to show.
  onHasData?: (hasData: boolean) => void;
}

// Real 5-star reviews (GET /products/reviews/featured), not the illustrative
// quotes with fabricated names/cities this section used to hardcode -- those
// were added before a reviews API existed; one exists now (review.controller.ts).
export default function Testimonials({ onHasData }: Props) {
  const [reviews, setReviews] = useState<FeaturedReview[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/products/reviews/featured`)
      .then(res => (res.ok ? res.json() : []))
      .then((data: FeaturedReview[]) => {
        setReviews(data);
        onHasData?.(Array.isArray(data) && data.length > 0);
      })
      .catch(() => {
        setReviews([]);
        onHasData?.(false);
      });
  }, []);

  if (reviews.length === 0) return null;

  return (
    <View style={styles.grid}>
      {reviews.slice(0, 3).map(r => (
        <View key={r.id} style={styles.card}>
          <View style={styles.starRow}>
            {Array.from({ length: 5 }).map((_, s) => (
              <Ionicons key={s} name={s < r.rating ? 'star' : 'star-outline'} size={14} color="#F5A300" />
            ))}
          </View>
          <Text style={styles.quote} numberOfLines={4}>&ldquo;{r.comment}&rdquo;</Text>
          <Text style={styles.role}>{r.userName || 'MechBazar Customer'} &middot; {r.productName}</Text>
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

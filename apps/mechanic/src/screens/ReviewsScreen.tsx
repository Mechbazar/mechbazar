import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { colors, Typography, Card, Loader, technicianService } from '@mechbazar/shared';
import { Star } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

const StarRow = ({ rating }: { rating: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={14} color={colors.warning} fill={n <= rating ? colors.warning : 'transparent'} />
    ))}
  </View>
);

export const ReviewsScreen = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['technician-reviews'],
    queryFn: () => technicianService.getMyReviews(1),
  });

  if (isLoading) {
    return <Loader size="large" color={colors.primary} style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={data?.reviews || []}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        data && data.total > 0 ? (
          <Card style={styles.summaryCard}>
            <Typography variant="h1">{data.avgRating.toFixed(1)}</Typography>
            <StarRow rating={Math.round(data.avgRating)} />
            <Typography variant="caption" style={{ marginTop: 4 }}>{data.total} review{data.total === 1 ? '' : 's'}</Typography>
          </Card>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Star color={colors.textSecondary} size={40} />
          <Typography variant="body" style={{ color: colors.textSecondary, marginTop: 12 }}>No reviews yet</Typography>
        </View>
      }
      renderItem={({ item }) => (
        <Card style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body" style={{ fontWeight: '700' }}>{item.customerName}</Typography>
            <StarRow rating={item.rating} />
          </View>
          {item.category && (
            <Typography variant="caption" style={{ marginTop: 2 }}>{item.category}</Typography>
          )}
          {item.comment && (
            <Typography variant="body" style={{ marginTop: 6 }}>{item.comment}</Typography>
          )}
          <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 6 }}>
            {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Typography>
        </Card>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { alignItems: 'center', paddingTop: 80 },
  summaryCard: { alignItems: 'center', paddingVertical: 20, marginBottom: 12 },
});

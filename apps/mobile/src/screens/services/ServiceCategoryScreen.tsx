import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { HeaderCartButton } from '../../components/HeaderCartButton';
import { ServicePackage } from '../../types/service';
import { fetchServicePackages } from '../../services/service.service';
import { colors } from './theme';

type ParamList = { ServiceCategory: { categoryId: string; categoryName: string } };

export default function ServiceCategoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ServiceCategory'>>();
  const { categoryId, categoryName } = route.params;

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServicePackages(categoryId).then((data) => {
      setPackages(data);
      setLoading(false);
    });
  }, [categoryId]);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{categoryName}</Text>
        <Text style={styles.headerSubtitle}>Choose a service package</Text>
      </View>
      <HeaderCartButton color="#FFFFFF" backgroundColor="rgba(255,255,255,0.15)" />
    </View>
  );

  const renderPackage = ({ item }: { item: ServicePackage }) => {
    const hasDiscount = item.discountPrice != null && item.discountPrice < item.price;
    const discountPct = hasDiscount ? Math.round(((item.price - item.discountPrice!) / item.price) * 100) : 0;
    return (
      <TouchableOpacity
        style={styles.packageCard}
        onPress={() => navigation.navigate('ServiceBooking', { packageId: item.id, categoryId })}
      >
        <View style={styles.packageImageWrap}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.packageImage} />
          ) : (
            <View style={styles.packageImageFallback}>
              <Text style={styles.packageImageIcon}>{item.category?.icon || '🔧'}</Text>
            </View>
          )}
          {hasDiscount && (
            <View style={styles.discountBadge}><Text style={styles.discountBadgeText}>{discountPct}% OFF</Text></View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.packageName}>{item.name}</Text>
          {!!item.description && <Text style={styles.packageDesc} numberOfLines={2}>{item.description}</Text>}
          <Text style={styles.packageMeta}>⏱ {item.estimatedMinutes} mins</Text>
          {item.reviewCount > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#F5A623" />
              <Text style={styles.packageMeta}>{item.rating.toFixed(1)} ({item.reviewCount})</Text>
            </View>
          )}
          {item.includedServices.length > 0 && (
            <View style={styles.includedRow}>
              {item.includedServices.slice(0, 3).map((s, i) => (
                <View key={i} style={styles.includedChip}>
                  <Text style={styles.includedChipText}>{s}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.priceRow}>
            {hasDiscount && <Text style={styles.originalPrice}>₹{item.price}</Text>}
            <Text style={styles.price}>₹{item.discountPrice ?? item.price}</Text>
          </View>
        </View>
        <View style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>Book</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      <FlatList
        data={packages}
        keyExtractor={(item) => item.id}
        renderItem={renderPackage}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔧</Text>
            <Text style={styles.emptyTitle}>No packages available</Text>
            <Text style={styles.emptySubtitle}>Check back soon for this service category.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  headerSubtitle: { fontSize: 13, color: '#9AA5B1', marginTop: 2 },

  listContent: { padding: 14 },
  packageCard: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight },
  packageImageWrap: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', marginRight: 12, backgroundColor: colors.pageBg, position: 'relative' },
  packageImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  packageImageFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  packageImageIcon: { fontSize: 26 },
  discountBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.primary, paddingVertical: 2, alignItems: 'center' },
  discountBadgeText: { color: colors.white, fontSize: 8, fontWeight: 'bold' },
  packageName: { fontSize: 15, fontWeight: '800', color: colors.textDark, marginBottom: 4 },
  packageDesc: { fontSize: 12, color: colors.textMuted, marginBottom: 6, lineHeight: 17 },
  packageMeta: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  includedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  includedChip: { backgroundColor: colors.pageBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  includedChipText: { fontSize: 10, color: colors.textDark, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  originalPrice: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through', marginRight: 8 },
  price: { fontSize: 17, fontWeight: '900', color: colors.textDark },

  bookBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 4 },
  bookBtnText: { color: colors.white, fontWeight: '800', fontSize: 12, paddingVertical: 8 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});

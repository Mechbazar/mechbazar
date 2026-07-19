import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  darkInk: '#111112',
  white: '#FFFFFF',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
  success: '#34C759',
  warning: '#FF9500',
};

type ParamList = {
  MechanicDetail: {
    id: string;
    name: string;
    rating: string;
    experience: string;
    distance: string;
    avatar: string;
    available: boolean;
  };
};

const SPECIALIZATIONS = [
  'Engine Diagnostics',
  'Brake Systems',
  'AC Servicing',
  'Electrical Repairs',
  'Suspension & Tyres',
];

const REVIEWS = [
  { id: '1', user: 'Ravi K.', rating: 5, comment: 'Very professional and quick. Fixed my brake pads in under an hour.', time: '2 days ago' },
  { id: '2', user: 'Priya M.', rating: 5, comment: 'Honest pricing, no hidden charges. Will book again!', time: '1 week ago' },
  { id: '3', user: 'Ajay S.', rating: 4, comment: 'Good work on AC servicing. Punctual and neat.', time: '2 weeks ago' },
];

export default function MechanicDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'MechanicDetail'>>();
  const { name, rating, experience, distance, avatar, available } = route.params;

  const [activeTab, setActiveTab] = useState<'overview' | 'reviews'>('overview');

  const handleCall = () => {
    Alert.alert(
      'Call Mechanic',
      `Do you want to call ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          onPress: () => Linking.openURL('tel:+919876543210'),
        },
      ]
    );
  };

  const handleVideoCall = () => {
    navigation.navigate('VideoCall', { mechanicName: name, mechanicAvatar: avatar });
  };

  const handleBookVisit = () => {
    navigation.navigate('ServiceBooking', { preselectedMechanic: { name, avatar, rating } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mechanic Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Profile Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroAvatarWrapper}>
            <Image source={{ uri: avatar }} style={styles.heroAvatar} />
            {available && <View style={styles.onlineDot} />}
          </View>

          <Text style={styles.heroName}>{name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.ratingText}>{rating} · {experience}</Text>
          </View>

          {/* Status Pills */}
          <View style={styles.pillRow}>
            <View style={[styles.pill, available ? styles.pillGreen : styles.pillGray]}>
              <View style={[styles.pillDot, { backgroundColor: available ? colors.success : colors.textMuted }]} />
              <Text style={[styles.pillText, { color: available ? colors.success : colors.textMuted }]}>
                {available ? 'Available Now' : 'Busy'}
              </Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="location-outline" size={12} color={colors.primary} />
              <Text style={[styles.pillText, { color: colors.primary }]}>{distance} away</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="shield-checkmark" size={12} color={colors.success} />
              <Text style={[styles.pillText, { color: colors.success }]}>Verified</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>287</Text>
            <Text style={styles.statLabel}>Jobs Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>4.9</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>98%</Text>
            <Text style={styles.statLabel}>Repeat Clients</Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>Reviews (47)</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' ? (
          <View style={styles.tabContent}>
            {/* Specializations */}
            <Text style={styles.sectionLabel}>Specializations</Text>
            <View style={styles.specGrid}>
              {SPECIALIZATIONS.map((spec) => (
                <View key={spec} style={styles.specChip}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.specText}>{spec}</Text>
                </View>
              ))}
            </View>

            {/* Service Area */}
            <Text style={styles.sectionLabel}>Service Coverage</Text>
            <View style={styles.infoCard}>
              <Ionicons name="map-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.infoCardText}>Within 10 km radius · Doorstep visit available</Text>
            </View>

            {/* Working Hours */}
            <Text style={styles.sectionLabel}>Working Hours</Text>
            <View style={styles.infoCard}>
              <Ionicons name="time-outline" size={18} color={colors.success} style={{ marginRight: 10 }} />
              <Text style={styles.infoCardText}>Mon – Sat: 8:00 AM – 8:00 PM</Text>
            </View>
          </View>
        ) : (
          <View style={styles.tabContent}>
            {REVIEWS.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{review.user[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewUser}>{review.user}</Text>
                    <View style={styles.reviewStars}>
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Ionicons key={i} name="star" size={12} color={colors.warning} />
                      ))}
                      <Text style={styles.reviewTime}> · {review.time}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
          <Ionicons name="call-outline" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.videoBtn} onPress={handleVideoCall}>
          <Ionicons name="videocam-outline" size={18} color={colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.videoBtnText}>Video Diagnose</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bookBtn} onPress={handleBookVisit} disabled={!available}>
          <Text style={styles.bookBtnText}>{available ? 'Book Visit' : 'Unavailable'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.secondary },

  heroCard: {
    backgroundColor: colors.white,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  heroAvatarWrapper: { position: 'relative', marginBottom: 14 },
  heroAvatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.primary },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  heroName: { fontSize: 22, fontWeight: '800', color: colors.secondary, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  ratingText: { fontSize: 14, color: colors.textMuted, marginLeft: 4 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
    gap: 4,
  },
  pillGreen: { backgroundColor: '#E8F9EE' },
  pillGray: { backgroundColor: '#F2F2F7' },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginBottom: 12,
    paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.secondary },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.borderLight },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  tabContent: { paddingHorizontal: 16, backgroundColor: colors.white, paddingTop: 16, paddingBottom: 8 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 10, marginTop: 16, textTransform: 'uppercase' },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    marginBottom: 4,
  },
  specText: { fontSize: 12, color: colors.secondary, fontWeight: '500' },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  infoCardText: { fontSize: 13, color: colors.secondary, flex: 1 },

  reviewCard: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reviewAvatarText: { color: colors.white, fontWeight: 'bold', fontSize: 14 },
  reviewUser: { fontSize: 13, fontWeight: '700', color: colors.secondary },
  reviewStars: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  reviewTime: { fontSize: 11, color: colors.textMuted },
  reviewComment: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 24,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  bookBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});

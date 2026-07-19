import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store';
import { API_BASE_URL } from '../services/api';

const colors = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textDark: '#111112',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
};

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { token } = useSelector((state: RootState) => state.auth);

  // States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [token]);

  const handleMarkAsRead = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/customers/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => 
          prev.map(notif => notif.id === id ? { ...notif, isRead: true } : notif)
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (id: string) => {
    // Since the database has no delete notification endpoint, we filter it out of the UI state
    setNotifications(prev => prev.filter(notif => notif.id !== id));
    Alert.alert('Deleted', 'Notification removed.');
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, !item.isRead && styles.cardUnread]}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLabelRow}>
          {!item.isRead && <View style={styles.unreadDot} />}
          <Text style={[styles.cardTitle, !item.isRead && styles.textBold]}>
            {item.title || 'Notification'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.cardBody}>{item.body || item.message}</Text>
      
      <View style={styles.cardFooter}>
        <Text style={styles.cardTime}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        {!item.isRead && (
          <TouchableOpacity onPress={() => handleMarkAsRead(item.id)}>
            <Text style={styles.markReadText}>Mark as read</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>You have no notifications at the moment.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    backgroundColor: colors.secondary 
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.white },
  centerLoader: { padding: 16 },
  listContent: { padding: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 12,
  },
  cardUnread: {
    borderColor: colors.primary,
    backgroundColor: '#FFFDFD',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerLabelRow: { flexDirection: 'row', alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 8 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  textBold: { fontWeight: '800' },
  cardBody: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingTop: 10, marginTop: 10 },
  cardTime: { fontSize: 10, color: colors.textMuted },
  markReadText: { fontSize: 11, fontWeight: 'bold', color: colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 }
});

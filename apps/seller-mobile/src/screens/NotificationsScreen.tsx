import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, Typography, Card, Loader, vendorService } from '@mechbazar/shared';
import { Bell, Check, Trash2 } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const NotificationsScreen = () => {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['vendor-notifications'],
    queryFn: vendorService.getNotifications,
  });

  const markRead = async (id: string) => {
    await vendorService.markNotificationRead(id);
    queryClient.invalidateQueries({ queryKey: ['vendor-notifications'] });
  };

  const remove = async (id: string) => {
    await vendorService.deleteNotification(id);
    queryClient.invalidateQueries({ queryKey: ['vendor-notifications'] });
  };

  if (isLoading) {
    return <Loader size="large" color={colors.primary} style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={notifications || []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Bell color={colors.textSecondary} size={40} />
          <Typography variant="body" style={{ color: colors.textSecondary, marginTop: 12 }}>No notifications yet</Typography>
        </View>
      }
      renderItem={({ item }) => (
        <Card style={{ ...styles.card, ...(item.isRead ? {} : styles.unreadCard) }}>
          <View style={{ flex: 1 }}>
            <Typography variant="body" style={{ fontWeight: '700' }}>{item.title}</Typography>
            <Typography variant="caption" style={{ marginTop: 2 }}>{item.body}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
              {new Date(item.createdAt).toLocaleString('en-IN')}
            </Typography>
          </View>
          <View style={styles.actions}>
            {!item.isRead && (
              <TouchableOpacity onPress={() => markRead(item.id)} style={styles.actionBtn}>
                <Check color={colors.success} size={18} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => remove(item.id)} style={styles.actionBtn}>
              <Trash2 color={colors.danger} size={18} />
            </TouchableOpacity>
          </View>
        </Card>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { alignItems: 'center', paddingTop: 80 },
  card: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, padding: 14 },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  actions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  actionBtn: { padding: 6 },
});

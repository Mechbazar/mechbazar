import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Loader, riderService } from '@mechbazar/shared';
import { Bell, BellOff, X, CheckCheck } from 'lucide-react-native';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  imageUrl?: string | null;
  createdAt: string;
}

// Rider previously had no notification history screen at all -- only push/
// socket toasts, nothing to review after the fact. Mirrors apps/mechanic's
// NotificationsScreen (same GET/PATCH/DELETE endpoints via riderService now),
// adapted to this app's Card/FlatList conventions (see DeliveryHistoryScreen).
export const NotificationsScreen = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<NotificationItem[]>({
    queryKey: ['rider-notifications'],
    queryFn: riderService.getNotifications,
  });

  const notifications = data || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = useCallback(
    async (id: string) => {
      queryClient.setQueryData<NotificationItem[]>(['rider-notifications'], (prev) =>
        (prev || []).map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      try {
        await riderService.markNotificationRead(id);
      } catch {
        refetch();
      }
    },
    [queryClient, refetch]
  );

  const markAllRead = useCallback(async () => {
    queryClient.setQueryData<NotificationItem[]>(['rider-notifications'], (prev) => (prev || []).map((n) => ({ ...n, isRead: true })));
    try {
      await riderService.markAllNotificationsRead();
    } catch {
      refetch();
    }
  }, [queryClient, refetch]);

  const remove = useCallback(
    async (id: string) => {
      const previous = queryClient.getQueryData<NotificationItem[]>(['rider-notifications']);
      queryClient.setQueryData<NotificationItem[]>(['rider-notifications'], (prev) => (prev || []).filter((n) => n.id !== id));
      try {
        await riderService.deleteNotification(id);
      } catch {
        queryClient.setQueryData(['rider-notifications'], previous);
      }
    },
    [queryClient]
  );

  if (isLoading) return <Loader fullScreen />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={notifications}
      keyExtractor={(item) => item.id}
      onRefresh={refetch}
      refreshing={isRefetching}
      ListHeaderComponent={
        unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllRow}>
            <CheckCheck size={14} color={colors.primary} />
            <Typography variant="caption" style={{ color: colors.primary, fontWeight: '700', marginLeft: 6 }}>
              Mark all read
            </Typography>
          </TouchableOpacity>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <BellOff size={40} color={colors.textSecondary} />
          <Typography variant="body" style={{ marginTop: 12, fontWeight: '700' }}>All caught up</Typography>
          <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
            New deliveries and payout updates will show up here.
          </Typography>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => markRead(item.id)} activeOpacity={0.7}>
          <Card style={item.isRead ? styles.card : { ...styles.card, ...styles.cardUnread }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={styles.iconWrap}>
                <Bell size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Typography variant="body" style={{ fontWeight: '700', flex: 1 }}>{item.title}</Typography>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
                <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>{item.body}</Typography>
                {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />}
                <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 6 }}>
                  {new Date(item.createdAt).toLocaleString()}
                </Typography>
              </View>
              <TouchableOpacity onPress={() => remove(item.id)} hitSlop={8}>
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </Card>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  markAllRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginBottom: 10 },
  card: { marginBottom: 10 },
  cardUnread: { borderColor: colors.primary, borderWidth: 1 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 6 },
  image: { width: '100%', height: 120, borderRadius: 10, marginTop: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
});

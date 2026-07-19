import React from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Loader, adminService } from '@mechbazar/shared';

// Mobile equivalent of apps/admin's NotificationBell.tsx dropdown -- same
// generic /customers/notifications endpoint (keyed on the authenticated
// admin user's own id via the JWT), rendered as a full screen list instead
// of a header dropdown.
export const NotificationsScreen = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: adminService.getNotifications,
    refetchInterval: 20000,
  });

  const notifications = data || [];

  const markReadMutation = useMutation({
    mutationFn: (id: string) => adminService.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <Typography variant="h2" style={{ padding: 16, paddingBottom: 8 }}>Notifications</Typography>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No notifications yet.</Typography>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => !item.isRead && markReadMutation.mutate(item.id)}>
            <Card style={{ opacity: item.isRead ? 0.6 : 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography variant="body" style={{ fontWeight: '700', flex: 1 }}>{item.title}</Typography>
                {!item.isRead && <View style={styles.dot} />}
              </View>
              <Typography variant="caption" style={{ marginTop: 4 }}>{item.body}</Typography>
              <Typography variant="caption" style={{ marginTop: 6, color: colors.textSecondary }}>{new Date(item.createdAt).toLocaleString()}</Typography>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginLeft: 8, marginTop: 4 },
});

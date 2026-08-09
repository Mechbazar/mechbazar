import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, TextInput, Image, Linking, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Loader, adminService, NotificationItem } from '@mechbazar/shared';
import { Search, CheckCheck } from 'lucide-react-native';
import { resolveNotificationRoute } from '../utils/notificationDeepLink';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ORDERS', label: 'Orders' },
  { key: 'VENDOR_UPDATES', label: 'Vendors' },
  { key: 'ACCOUNT', label: 'Account' },
  { key: 'SYSTEM', label: 'System' },
];

// Mobile equivalent of apps/admin's NotificationCenter.tsx dropdown -- same
// generic /customers/notifications endpoint (keyed on the authenticated
// admin user's own id via the JWT), rendered as a full screen list instead
// of a header dropdown.
export const NotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pages, setPages] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [fetchingMore, setFetchingMore] = useState(false);

  const onSearchChange = (text: string) => {
    setSearch(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setDebouncedSearch(text), 400);
  };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-notifications', debouncedSearch, category],
    queryFn: () =>
      adminService.getNotificationsPage({
        limit: 20,
        ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
        ...(category !== 'ALL' ? { category } : {}),
      }),
    refetchInterval: 20000,
  });

  React.useEffect(() => {
    if (data) {
      setPages(data.items);
      setCursor(data.nextCursor);
    }
  }, [data]);

  const fetchNextPage = useCallback(async () => {
    if (!cursor || fetchingMore) return;
    setFetchingMore(true);
    try {
      const page = await adminService.getNotificationsPage({
        limit: 20,
        cursor,
        ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
        ...(category !== 'ALL' ? { category } : {}),
      });
      setPages((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setFetchingMore(false);
    }
  }, [cursor, fetchingMore, debouncedSearch, category]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => adminService.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  const markAllRead = async () => {
    await adminService.markAllNotificationsRead();
    queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
  };

  const openNotification = (item: NotificationItem) => {
    if (!item.isRead) markReadMutation.mutate(item.id);
    adminService.markNotificationOpened(item.id).catch(() => {});
    const target = resolveNotificationRoute(item);
    if (target) navigation.navigate(target.screen, target.params);
  };

  const openAction = (deepLink: string) => {
    if (/^(https?:|tel:|mailto:)/i.test(deepLink)) Linking.openURL(deepLink).catch(() => {});
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Typography variant="h2">Notifications</Typography>
        <TouchableOpacity onPress={markAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <CheckCheck color={colors.primary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Search color={colors.textSecondary} size={16} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search notifications"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(c) => c.key}
        style={styles.chipsRow}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item: c }) => (
          <TouchableOpacity onPress={() => setCategory(c.key)} style={[styles.chip, category === c.key && styles.chipActive]}>
            <Typography variant="caption" style={{ color: category === c.key ? colors.card : colors.textSecondary, fontWeight: '700' }}>
              {c.label}
            </Typography>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={pages}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onEndReachedThreshold={0.4}
        onEndReached={fetchNextPage}
        ListFooterComponent={fetchingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No notifications yet.</Typography>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openNotification(item)}>
            <Card style={{ opacity: item.isRead ? 0.6 : 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography variant="body" style={{ fontWeight: '700', flex: 1 }}>{item.title}</Typography>
                {!item.isRead && <View style={styles.dot} />}
              </View>
              <Typography variant="caption" style={{ marginTop: 4 }}>{item.body}</Typography>
              {!!item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />}
              {!!item.actions?.length && (
                <View style={styles.actionsRow}>
                  {item.actions.map((action, idx) => (
                    <TouchableOpacity key={idx} style={styles.actionChip} onPress={() => openAction(action.deepLink)}>
                      <Typography variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>{action.label}</Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },
  chipsRow: { marginTop: 12, marginBottom: 4, flexGrow: 0 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginLeft: 8, marginTop: 4 },
  image: { width: '100%', height: 120, borderRadius: 10, marginTop: 8 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionChip: { borderWidth: 1, borderColor: colors.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
});

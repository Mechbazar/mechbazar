import React, { useState, useRef, useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, TextInput, Image, Linking, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, Typography, Card, Loader, technicianService, NotificationItem } from '@mechbazar/shared';
import { Bell, Check, Trash2, Search, CheckCheck } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveNotificationRoute } from '../utils/notificationDeepLink';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'MECHANIC_UPDATES', label: 'Jobs' },
  { key: 'SERVICES', label: 'Services' },
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'ACCOUNT', label: 'Account' },
  { key: 'SYSTEM', label: 'System' },
];

export const NotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const onSearchChange = (text: string) => {
    setSearch(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setDebouncedSearch(text), 400);
  };

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } = useInfiniteNotifications(
    debouncedSearch,
    category
  );

  const notifications = data ?? [];

  const markRead = async (id: string) => {
    await technicianService.markNotificationRead(id);
    queryClient.invalidateQueries({ queryKey: ['technician-notifications'] });
  };

  const markAllRead = async () => {
    await technicianService.markAllNotificationsRead();
    queryClient.invalidateQueries({ queryKey: ['technician-notifications'] });
  };

  const remove = async (id: string) => {
    await technicianService.deleteNotification(id);
    queryClient.invalidateQueries({ queryKey: ['technician-notifications'] });
  };

  const openNotification = (item: NotificationItem) => {
    if (!item.isRead) markRead(item.id);
    technicianService.markNotificationOpened(item.id).catch(() => {});
    const target = resolveNotificationRoute(item);
    if (target) navigation.navigate(target.screen, target.params);
  };

  const openAction = (deepLink: string) => {
    if (/^(https?:|tel:|mailto:)/i.test(deepLink)) Linking.openURL(deepLink).catch(() => {});
  };

  if (isLoading) {
    return <Loader size="large" color={colors.primary} style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Search color={colors.textSecondary} size={16} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search notifications"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
        />
        <TouchableOpacity onPress={markAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <CheckCheck color={colors.primary} size={18} />
        </TouchableOpacity>
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
            <Typography variant="caption" style={{ color: category === c.key ? colors.background : colors.textSecondary, fontWeight: '700' }}>
              {c.label}
            </Typography>
          </TouchableOpacity>
        )}
      />

      <FlatList
        style={styles.container}
        contentContainerStyle={{ padding: 16 }}
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        onEndReachedThreshold={0.4}
        onEndReached={() => hasNextPage && fetchNextPage()}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell color={colors.textSecondary} size={40} />
            <Typography variant="body" style={{ color: colors.textSecondary, marginTop: 12 }}>No notifications yet</Typography>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.85} onPress={() => openNotification(item)}>
            <Card style={{ ...styles.card, ...(item.isRead ? {} : styles.unreadCard) }}>
              <View style={{ flex: 1 }}>
                <Typography variant="body" style={{ fontWeight: '700' }}>{item.title}</Typography>
                <Typography variant="caption" style={{ marginTop: 2 }}>{item.body}</Typography>
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
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

// Cursor-paginated fetch, flattened into one array for the FlatList. Kept
// local rather than a shared hook since each app's query key differs.
function useInfiniteNotifications(q: string, category: string) {
  const query = useQuery({
    queryKey: ['technician-notifications', q, category],
    queryFn: async () => {
      const page = await technicianService.getNotificationsPage({
        limit: 20,
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(category !== 'ALL' ? { category } : {}),
      });
      return page;
    },
  });

  const [pages, setPages] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [fetchingMore, setFetchingMore] = useState(false);

  React.useEffect(() => {
    if (query.data) {
      setPages(query.data.items);
      setCursor(query.data.nextCursor);
    }
  }, [query.data]);

  const fetchNextPage = useCallback(async () => {
    if (!cursor || fetchingMore) return;
    setFetchingMore(true);
    try {
      const page = await technicianService.getNotificationsPage({
        limit: 20,
        cursor,
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(category !== 'ALL' ? { category } : {}),
      });
      setPages((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setFetchingMore(false);
    }
  }, [cursor, fetchingMore, q, category]);

  return {
    data: pages,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    isFetchingNextPage: fetchingMore,
    hasNextPage: !!cursor,
    fetchNextPage,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },
  chipsRow: { marginTop: 12, marginBottom: 4, flexGrow: 0 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary },
  empty: { alignItems: 'center', paddingTop: 80 },
  card: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, padding: 14 },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  image: { width: '100%', height: 120, borderRadius: 10, marginTop: 8 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionChip: { borderWidth: 1, borderColor: colors.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  actions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  actionBtn: { padding: 6 },
});

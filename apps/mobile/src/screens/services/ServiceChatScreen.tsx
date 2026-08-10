import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ServiceChatMessage } from '../../types/service';
import { fetchBookingMessages, sendBookingMessage } from '../../services/service.service';
import { useIsDarkMode } from '../../theme/useThemeColors';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../../components/desktop/shared/CompactBookingShell';

type ParamList = { ServiceChat: { bookingId: string } };
const POLL_INTERVAL_MS = 5000;

export default function ServiceChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ServiceChat'>>();
  const { bookingId } = route.params;
  const { token, user } = useSelector((state: RootState) => state.auth);

  const [messages, setMessages] = useState<ServiceChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Full-page (no marketing footer) -- a chat screen's input bar should be
  // the last visible element, not have a multi-column footer pushed in
  // below it the way DesktopAppShell's default wrap would.
  const { isDesktopUp } = useBreakpoint();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const poll = async () => {
      const data = await fetchBookingMessages(token, bookingId);
      if (!cancelled) setMessages(data);
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token, bookingId]);

  const handleSend = async () => {
    if (!draft.trim() || !token) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    const res = await sendBookingMessage(token, bookingId, text);
    setSending(false);
    if (res.ok) {
      const data = await fetchBookingMessages(token, bookingId);
      setMessages(data);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat with Mechanic</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <CompactBookingShell maxWidth={720} style={styles.flexFill}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMine = item.senderUserId === user?.id;
            return (
              <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.message}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} disabled={sending || !draft.trim()} onPress={handleSend}>
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
        </CompactBookingShell>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// `darkInk` is a fixed brand-dark header bar, deliberately unchanged in dark
// mode. `white` (header text, own-bubble text, send-button icon) stays
// literal white in both themes since it always sits on a permanently-dark
// or brand-red surface. `surface` is the actual card/bubble/input-bar
// background and inverts. `bubbleMine` deliberately keeps its solid
// `primary` (brand-red) background with fixed white text -- only the
// "their message" bubble (a neutral card) inverts like any other surface.
const LIGHT_COLORS = {
  primary: '#DA3830',
  darkInk: '#1B1B1B',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  darkInk: '#1B1B1B',
  pageBg: '#121212',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
};

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },

  listContent: { padding: 14, flexGrow: 1 },
  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.borderLight },
  bubbleText: { fontSize: 14, color: colors.textDark },
  bubbleTextMine: { color: colors.white },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: colors.textMuted },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  input: { flex: 1, backgroundColor: colors.pageBg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.textDark, maxHeight: 100, marginRight: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: colors.white, fontSize: 16, fontWeight: 'bold' },
});

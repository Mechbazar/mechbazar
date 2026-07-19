import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, Typography, Card, Input, Button, technicianService } from '@mechbazar/shared';
import { Send } from 'lucide-react-native';

type Message = {
  id: string;
  message: string;
  senderRole: 'CUSTOMER' | 'TECHNICIAN';
  createdAt: string;
};

const POLL_INTERVAL_MS = 5000;

// Ported from apps/mobile's ServiceChatScreen (same 5s poll, no realtime
// infra exists anywhere in this codebase), rebuilt with @mechbazar/shared's
// component set to match the rest of this app's visual language.
export const BookingChatScreen = () => {
  const route = useRoute<any>();
  const { bookingId } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await technicianService.getBookingMessages(bookingId);
        if (!cancelled) setMessages(data);
      } catch (error) {
        console.error('Failed to fetch messages', error);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [bookingId]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      await technicianService.sendBookingMessage(bookingId, text);
      const data = await technicianService.getBookingMessages(bookingId);
      setMessages(data);
    } catch (error: any) {
      console.error('Failed to send message', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 14, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMine = item.senderRole === 'TECHNICIAN';
          return (
            <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <Card style={{ ...styles.bubble, ...(isMine ? styles.bubbleMine : styles.bubbleTheirs) }}>
                <Typography variant="body" style={isMine ? { color: '#ffffff' } : undefined}>{item.message}</Typography>
              </Card>
            </View>
          );
        }}
        ListEmptyComponent={
          <Typography variant="body" style={{ textAlign: 'center', marginTop: 40, color: colors.textSecondary }}>
            No messages yet. Say hello!
          </Typography>
        }
      />

      <View style={styles.inputRow}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message..."
          containerStyle={{ flex: 1, marginBottom: 0 }}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} disabled={sending || !draft.trim()} onPress={handleSend}>
          <Send color="#ffffff" size={18} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%' },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.card },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
});

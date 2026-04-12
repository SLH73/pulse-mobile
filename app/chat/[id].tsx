import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // Obtener usuario actual
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Cargar mensajes iniciales
  useEffect(() => {
    if (!id) return;

    // Si el id es del mock (contactos simulados) mostrar mensaje de bienvenida
    if (id === '1' || id === '2' || id === '3') {
      setMessages([{
        id: '1',
        content: '¡Hola! Soy tu Pulse de hoy.',
        sender_id: 'other',
        created_at: new Date().toISOString(),
      }]);
      return;
    }

    // Cargar mensajes reales de Supabase
    supabase
      .from('messages')
      .select('*')
      .eq('match_id', id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data);
      });

    // Suscripción Realtime
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${id}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !userId) return;
    setDraft('');

    // Si es un match simulado, añadir localmente
    if (id === '1' || id === '2' || id === '3') {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: text,
        sender_id: userId,
        created_at: new Date().toISOString(),
      }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return;
    }

    // Enviar mensaje real a Supabase
    await supabase.from('messages').insert({
      match_id: id,
      sender_id: userId,
      content: text,
      expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.timer}>68h restantes</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isOwn = item.sender_id === userId;
          return (
            <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, { color: isOwn ? '#0D0D0D' : '#F0F0EE' }]}>
                {item.content}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribe algo real..."
          placeholderTextColor="#444441"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { opacity: draft.trim() ? 1 : 0.4 }]}
          onPress={sendMessage}
          disabled={!draft.trim()}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16, paddingTop: 48,
    borderBottomWidth: 0.5, borderBottomColor: '#2E2E2C',
  },
  back: { fontSize: 15, color: '#7F77DD' },
  timer: { fontSize: 13, color: '#5F5E5A' },
  messageList: { padding: 16, gap: 12 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleOwn: {
    backgroundColor: '#7F77DD',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#1A1A18',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  inputRow: {
    flexDirection: 'row', gap: 8,
    padding: 12, borderTopWidth: 0.5,
    borderTopColor: '#2E2E2C',
  },
  input: {
    flex: 1, backgroundColor: '#1A1A18',
    borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15,
    color: '#F0F0EE', maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#7F77DD', borderRadius: 22,
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { fontSize: 18, color: '#0D0D0D', fontWeight: '500' },
});
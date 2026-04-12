import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
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

const MOCK_IDS = ['1', '2', '3'];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [matchUserId, setMatchUserId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const listRef = useRef<FlatList>(null);
  const isMock = MOCK_IDS.includes(id ?? '');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!id || isMock) {
      setMessages([{
        id: '1', content: '¡Hola! Soy tu Pulse de hoy.',
        sender_id: 'other', created_at: new Date().toISOString(),
      }]);
      return;
    }

    // Obtener el match para saber quién es el otro usuario
    supabase
      .from('daily_matches')
      .select('user_a, user_b')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data && userId) {
          const other = data.user_a === userId ? data.user_b : data.user_a;
          setMatchUserId(other);
        }
      });

    // Cargar mensajes
    supabase
      .from('messages')
      .select('*')
      .eq('match_id', id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setMessages(data); });

    // Realtime
    const channel = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'messages', filter: `match_id=eq.${id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, userId]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !userId) return;
    setDraft('');

    if (isMock) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), content: text,
        sender_id: userId, created_at: new Date().toISOString(),
      }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return;
    }

    await supabase.from('messages').insert({
      match_id: id,
      sender_id: userId,
      content: text,
      expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    });
  };

  const saveContact = async () => {
    if (!userId || !matchUserId || !id) return;

    const { error } = await supabase.from('saved_contacts').insert({
      user_id: userId,
      contact_id: matchUserId,
      match_id: id,
    });

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Ya guardado', 'Este contacto ya está en tu lista.');
      } else {
        Alert.alert('Error', error.message);
      }
      return;
    }

    // Actualizar depth_score
    await supabase.rpc('increment_depth_score', { p_user_id: userId });

    setIsSaved(true);
    Alert.alert('Conexión guardada', 'Este contacto se ha añadido a tu lista.');
  };

  const messageCount = messages.filter(m => m.sender_id === userId).length;
  const canSave = !isMock && messageCount >= 3 && !isSaved;

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={80}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {canSave && (
            <TouchableOpacity style={styles.saveBtn} onPress={saveContact}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          )}
          {isSaved && <Text style={styles.savedText}>✓ Guardado</Text>}
          <Text style={styles.timer}>68h restantes</Text>
        </View>
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

      {canSave && (
        <View style={styles.saveBanner}>
          <Text style={styles.saveBannerText}>
            ¿Esta conexión vale la pena? Guárdala antes de que expire.
          </Text>
        </View>
      )}

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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 15, color: '#7F77DD' },
  timer: { fontSize: 13, color: '#5F5E5A' },
  saveBtn: {
    backgroundColor: '#1D1D3A', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 0.5, borderColor: '#7F77DD',
  },
  saveBtnText: { fontSize: 13, color: '#7F77DD', fontWeight: '500' },
  savedText: { fontSize: 13, color: '#1D9E75', fontWeight: '500' },
  messageList: { padding: 16, gap: 12 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleOwn: { backgroundColor: '#7F77DD', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1A1A18', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  saveBanner: {
    backgroundColor: '#1D1D3A', padding: 12,
    borderTopWidth: 0.5, borderTopColor: '#7F77DD',
  },
  saveBannerText: { fontSize: 13, color: '#7F77DD', textAlign: 'center' },
  inputRow: {
    flexDirection: 'row', gap: 8,
    padding: 12, borderTopWidth: 0.5, borderTopColor: '#2E2E2C',
  },
  input: {
    flex: 1, backgroundColor: '#1A1A18', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#F0F0EE', maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#7F77DD', borderRadius: 22,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { fontSize: 18, color: '#0D0D0D', fontWeight: '500' },
});
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

// ────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

interface MatchState {
  user_a: string;
  user_b: string;
  expires_at: string | null;   // null = permanente
  saved_by_a: boolean;
  saved_by_b: boolean;
  mutual_save_count: number;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const MOCK_IDS = ['1', '2', '3'];

function formatTimer(expiresAt: string | null): string {
  if (!expiresAt) return 'Conexion permanente';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expirado';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function timerIsUrgent(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return ms > 0 && ms < 6 * 3_600_000; // menos de 6 horas
}

// ────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [messages, setMessages]   = useState<Message[]>([]);
  const [draft, setDraft]         = useState('');
  const [userId, setUserId]       = useState<string | null>(null);
  const [match, setMatch]         = useState<MatchState | null>(null);
  const [timerLabel, setTimerLabel] = useState('...');
  const [saving, setSaving]       = useState(false);

  const listRef  = useRef<FlatList>(null);
  const isMock   = MOCK_IDS.includes(id ?? '');

  // ── Sesión ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // ── Cargar match + mensajes + realtime ──────────────────
  useEffect(() => {
    if (!id || isMock) {
      setMessages([{
        id: '1',
        content: '¡Hola! Soy tu Pulse de hoy.',
        sender_id: 'other',
        created_at: new Date().toISOString(),
      }]);
      return;
    }

    // Datos del match (incluye nuevas columnas)
    supabase
      .from('daily_matches')
      .select('user_a, user_b, expires_at, saved_by_a, saved_by_b, mutual_save_count')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setMatch(data as MatchState);
      });

    // Mensajes iniciales
    supabase
      .from('messages')
      .select('*')
      .eq('match_id', id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setMessages(data); });

    // Realtime — mensajes
    const msgChannel = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'messages', filter: `match_id=eq.${id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    // Realtime — estado del match (expires_at, saved_by_*, mutual_save_count)
    const matchChannel = supabase
      .channel(`match_state:${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'daily_matches', filter: `id=eq.${id}`,
      }, (payload) => {
        setMatch(payload.new as MatchState);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(matchChannel);
    };
  }, [id, userId]);

  // ── Timer en tiempo real (cada minuto) ──────────────────
  useEffect(() => {
    if (isMock) { setTimerLabel('72h restantes'); return; }
    if (!match) return;

    const tick = () => setTimerLabel(formatTimer(match.expires_at));
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [match?.expires_at]);

  // ── Enviar mensaje ───────────────────────────────────────
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
      match_id:   id,
      sender_id:  userId,
      content:    text,
      expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    });
  };

  // ── Guardar contacto (extensión mutua) ───────────────────
  const saveContact = async () => {
    if (!userId || !id || isMock || saving) return;
    setSaving(true);

    const { data, error } = await supabase.rpc('handle_mutual_save', {
      p_match_id: id,
      p_user_id:  userId,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    const result = data as {
      status: 'saved' | 'mutual_save' | 'already_saved' | string;
      mutual_save_count: number;
      expires_at: string | null;
      permanent: boolean;
    };

    if (result.status === 'already_saved') {
      Alert.alert('Ya guardado', 'Ya habias guardado esta conexion.');
      return;
    }

    if (result.status === 'mutual_save') {
      if (result.permanent) {
        Alert.alert(
          '¡Conexion permanente!',
          'Los dos habeis querido seguir. Esta conexion ya no expira.',
        );
      } else {
        const extensionsLeft = 3 - result.mutual_save_count;
        Alert.alert(
          '¡Mutuo! Chat extendido 72h',
          `Los dos habeis guardado la conexion. Quedan ${extensionsLeft} extension${extensionsLeft === 1 ? '' : 'es'} posibles.`,
        );
      }
    } else {
      // Solo yo he guardado de momento
      Alert.alert(
        'Conexion guardada',
        'Has guardado esta conexion. Si la otra persona tambien guarda, el chat se extiende 72h mas.',
      );
    }
  };

  // ── Estado derivado ──────────────────────────────────────
  const messageCount = messages.filter(m => m.sender_id === userId).length;
  const isPermanent  = match?.expires_at === null && match?.mutual_save_count > 0;

  // ¿Ya he guardado yo?
  const iAmA    = match?.user_a === userId;
  const iSaved  = match ? (iAmA ? match.saved_by_a : match.saved_by_b) : false;

  // ¿El otro ha guardado?
  const otherSaved = match ? (iAmA ? match.saved_by_b : match.saved_by_a) : false;

  // Puedo guardar si: hay suficientes mensajes, no he guardado aún, no es mock
  const canSave = !isMock && messageCount >= 3 && !iSaved;

  // ── Banner dinámico ──────────────────────────────────────
  const renderBanner = () => {
    if (isMock) return null;

    if (isPermanent) {
      return (
        <View style={[styles.banner, styles.bannerPermanent]}>
          <Text style={styles.bannerTextPermanent}>
            ★ Conexion permanente — esta conversacion no expira
          </Text>
        </View>
      );
    }

    if (iSaved && otherSaved && match && match.mutual_save_count > 0) {
      const extensionsLeft = 3 - match.mutual_save_count;
      return (
        <View style={[styles.banner, styles.bannerMutual]}>
          <Text style={styles.bannerTextMutual}>
            Guardado mutuamente · Chat extendido 72h ·{' '}
            {extensionsLeft > 0
              ? `${extensionsLeft} extension${extensionsLeft === 1 ? '' : 'es'} posibles`
              : 'Proxima extension sera permanente'}
          </Text>
        </View>
      );
    }

    if (iSaved && !otherSaved) {
      return (
        <View style={[styles.banner, styles.bannerWaiting]}>
          <Text style={styles.bannerTextWaiting}>
            Has guardado esta conexion. Esperando que la otra persona tambien guarde...
          </Text>
        </View>
      );
    }

    if (canSave) {
      return (
        <View style={[styles.banner, styles.bannerSave]}>
          <Text style={styles.bannerTextSave}>
            ¿Esta conexion vale la pena? Guardala antes de que expire.
          </Text>
        </View>
      );
    }

    if (!isMock && messageCount < 3) {
      return (
        <View style={[styles.banner, styles.bannerInfo]}>
          <Text style={styles.bannerTextInfo}>
            Envia {3 - messageCount} mensaje{3 - messageCount === 1 ? '' : 's'} mas para poder guardar esta conexion.
          </Text>
        </View>
      );
    }

    return null;
  };

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  const urgent = match ? timerIsUrgent(match.expires_at) : false;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={80}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Volver</Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {canSave && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveContact}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? '...' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          )}

          {iSaved && !isPermanent && (
            <Text style={styles.savedText}>✓ Guardado</Text>
          )}

          {isPermanent ? (
            <Text style={styles.permanentText}>★ Permanente</Text>
          ) : (
            <Text style={[styles.timer, urgent && styles.timerUrgent]}>
              {timerLabel}
            </Text>
          )}
        </View>
      </View>

      {/* MENSAJES */}
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

      {/* BANNER DINAMICO */}
      {renderBanner()}

      {/* INPUT */}
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

// ────────────────────────────────────────────────────────────
// Estilos
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16, paddingTop: 48,
    borderBottomWidth: 0.5, borderBottomColor: '#2E2E2C',
  },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back:         { fontSize: 15, color: '#7F77DD' },
  timer:        { fontSize: 13, color: '#5F5E5A' },
  timerUrgent:  { color: '#E05252' },
  permanentText:{ fontSize: 13, color: '#1D9E75', fontWeight: '500' },

  saveBtn: {
    backgroundColor: '#1D1D3A', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 0.5, borderColor: '#7F77DD',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:  { fontSize: 13, color: '#7F77DD', fontWeight: '500' },
  savedText:    { fontSize: 13, color: '#1D9E75', fontWeight: '500' },

  messageList:  { padding: 16, gap: 12 },
  bubble:       { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleOwn:    { backgroundColor: '#7F77DD', alignSelf: 'flex-end',  borderBottomRightRadius: 4 },
  bubbleOther:  { backgroundColor: '#1A1A18', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText:   { fontSize: 15, lineHeight: 22 },

  // Banners
  banner:              { padding: 12, borderTopWidth: 0.5 },
  bannerSave:          { backgroundColor: '#1D1D3A', borderTopColor: '#7F77DD' },
  bannerTextSave:      { fontSize: 13, color: '#7F77DD', textAlign: 'center' },

  bannerWaiting:       { backgroundColor: '#1A1A18', borderTopColor: '#5F5E5A' },
  bannerTextWaiting:   { fontSize: 13, color: '#8F8E8A', textAlign: 'center' },

  bannerMutual:        { backgroundColor: '#1A2A1A', borderTopColor: '#1D9E75' },
  bannerTextMutual:    { fontSize: 13, color: '#1D9E75', textAlign: 'center' },

  bannerPermanent:     { backgroundColor: '#1A2A1A', borderTopColor: '#1D9E75' },
  bannerTextPermanent: { fontSize: 13, color: '#1D9E75', textAlign: 'center', fontWeight: '500' },

  bannerInfo:          { backgroundColor: '#1A1A18', borderTopColor: '#2E2E2C' },
  bannerTextInfo:      { fontSize: 13, color: '#5F5E5A', textAlign: 'center' },

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

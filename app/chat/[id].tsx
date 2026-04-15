import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { supabase } from '../../src/lib/supabase';
import { moderateMessage } from '../../src/lib/moderation';

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
  expires_at: string | null;
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
  return ms > 0 && ms < 6 * 3_600_000;
}

// Genera un color HSL determinista a partir de un string
function seedToColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 65%)`;
}

// ────────────────────────────────────────────────────────────
// Componente: tarjeta viral (se captura con ViewShot)
// ────────────────────────────────────────────────────────────

interface ShareCardProps {
  matchId: string;
}

function ShareCard({ matchId }: ShareCardProps) {
  const color1 = seedToColor(matchId);
  const color2 = seedToColor(matchId + '_b');

  return (
    <View style={card.container}>
      {/* Fondo con círculos generativos */}
      <View style={[card.circle1, { backgroundColor: color1 }]} />
      <View style={[card.circle2, { backgroundColor: color2 }]} />
      <View style={[card.circle3, { backgroundColor: color1, opacity: 0.3 }]} />

      {/* Contenido */}
      <View style={card.content}>
        <Text style={card.logo}>pulse</Text>
        <Text style={card.mainText}>Conecte con{'\n'}alguien real</Text>
        <Text style={card.subText}>Una conexion al dia.{'\n'}Eso es todo lo que necesitas.</Text>
        <View style={card.badge}>
          <Text style={card.badgeText}>pulseapp.es</Text>
        </View>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  container: {
    width: 320, height: 320,
    backgroundColor: '#0D0D0D',
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle1: {
    position: 'absolute', width: 200, height: 200,
    borderRadius: 100, top: -40, right: -40, opacity: 0.25,
  },
  circle2: {
    position: 'absolute', width: 150, height: 150,
    borderRadius: 75, bottom: -30, left: -20, opacity: 0.2,
  },
  circle3: {
    position: 'absolute', width: 100, height: 100,
    borderRadius: 50, top: 60, left: 40,
  },
  content: {
    alignItems: 'center', gap: 12, padding: 32, zIndex: 1,
  },
  logo:     { fontSize: 13, color: '#7F77DD', letterSpacing: 2, fontWeight: '500' },
  mainText: { fontSize: 28, fontWeight: '500', color: '#F0F0EE', textAlign: 'center', lineHeight: 36 },
  subText:  { fontSize: 14, color: '#8F8E8A', textAlign: 'center', lineHeight: 20 },
  badge: {
    backgroundColor: '#1A1A18', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 0.5, borderColor: '#2E2E2C',
    marginTop: 8,
  },
  badgeText: { fontSize: 13, color: '#5F5E5A' },
});

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [messages, setMessages]       = useState<Message[]>([]);
  const [draft, setDraft]             = useState('');
  const [userId, setUserId]           = useState<string | null>(null);
  const [match, setMatch]             = useState<MatchState | null>(null);
  const [timerLabel, setTimerLabel]   = useState('...');
  const [saving, setSaving]           = useState(false);
  const [moderating, setModerating]   = useState(false);
  const [blockedText, setBlockedText] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing]         = useState(false);

  const listRef    = useRef<FlatList>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const isMock     = MOCK_IDS.includes(id ?? '');

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

    supabase
      .from('daily_matches')
      .select('user_a, user_b, expires_at, saved_by_a, saved_by_b, mutual_save_count')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setMatch(data as MatchState);
      });

    supabase
      .from('messages')
      .select('*')
      .eq('match_id', id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setMessages(data); });

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

    const matchChannel = supabase
      .channel(`match_state:${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'daily_matches', filter: `id=eq.${id}`,
      }, (payload) => {
        const newMatch = payload.new as MatchState;
        const prev = match;

        // Detectar nuevo mutual save para mostrar modal
        if (prev && !prev.saved_by_a && newMatch.saved_by_a && newMatch.saved_by_b) {
          setShowShareModal(true);
        }
        if (prev && !prev.saved_by_b && newMatch.saved_by_b && newMatch.saved_by_a) {
          setShowShareModal(true);
        }

        setMatch(newMatch);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(matchChannel);
    };
  }, [id, userId]);

  // ── Timer en tiempo real ─────────────────────────────────
  useEffect(() => {
    if (isMock) { setTimerLabel('72h restantes'); return; }
    if (!match) return;
    const tick = () => setTimerLabel(formatTimer(match.expires_at));
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [match?.expires_at]);

  // ── Enviar mensaje con moderación ───────────────────────
  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !userId || moderating) return;

    setDraft('');
    setBlockedText(null);

    if (isMock) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), content: text,
        sender_id: userId, created_at: new Date().toISOString(),
      }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return;
    }

    setModerating(true);
    const modResult = await moderateMessage(text);
    setModerating(false);

    if (!modResult.approved) {
      setBlockedText(
        `Mensaje bloqueado por ${modResult.reason ?? 'contenido inapropiado'}. ` +
        'Por favor, manten un trato respetuoso.'
      );

      if (modResult.flag) {
        const maxScore = Math.max(
          modResult.scores.toxicity,
          modResult.scores.threat,
          modResult.scores.sexually_explicit,
        );
        await supabase.from('moderation_flags').insert({
          user_id:      userId,
          match_id:     id,
          content:      text,
          reason:       modResult.reason ?? 'desconocido',
          score:        maxScore,
          auto_flagged: true,
          reviewed:     false,
        });
      }
      return;
    }

    await supabase.from('messages').insert({
      match_id:   id,
      sender_id:  userId,
      content:    text,
      expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    });
  };

  // ── Guardar contacto ─────────────────────────────────────
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
      // Mostrar modal de compartir en mutual save
      setShowShareModal(true);
    } else {
      Alert.alert(
        'Conexion guardada',
        'Has guardado esta conexion. Si la otra persona tambien guarda, el chat se extiende 72h mas.',
      );
    }
  };

  // ── Compartir tarjeta viral ──────────────────────────────
  const shareCard = async () => {
    if (!viewShotRef.current || sharing) return;
    setSharing(true);

    try {
      const uri = await viewShotRef.current.capture();
      await Share.share({
        url:     uri,
        message: 'Conecte con alguien real en Pulse. Una conexion al dia. pulseapp.es',
      });
    } catch (e) {
      console.log('[share] cancelado o error', e);
    } finally {
      setSharing(false);
    }
  };

  // ── Estado derivado ──────────────────────────────────────
  const messageCount = messages.filter(m => m.sender_id === userId).length;
  const isPermanent  = match?.expires_at === null && match?.mutual_save_count > 0;
  const iAmA         = match?.user_a === userId;
  const iSaved       = match ? (iAmA ? match.saved_by_a : match.saved_by_b) : false;
  const otherSaved   = match ? (iAmA ? match.saved_by_b : match.saved_by_a) : false;
  const canSave      = !isMock && messageCount >= 3 && !iSaved;
  const urgent       = match ? timerIsUrgent(match.expires_at) : false;

  // ── Banner dinámico ──────────────────────────────────────
  const renderBanner = () => {
    if (blockedText) {
      return (
        <View style={[styles.banner, styles.bannerBlocked]}>
          <Text style={styles.bannerTextBlocked}>⚠ {blockedText}</Text>
        </View>
      );
    }

    if (isMock) return null;

    if (isPermanent) {
      return (
        <View style={[styles.banner, styles.bannerPermanent]}>
          <Text style={styles.bannerTextPermanent}>★ Conexion permanente — esta conversacion no expira</Text>
        </View>
      );
    }

    if (iSaved && otherSaved && match && match.mutual_save_count > 0) {
      const extensionsLeft = 3 - match.mutual_save_count;
      return (
        <TouchableOpacity
          style={[styles.banner, styles.bannerMutual]}
          onPress={() => setShowShareModal(true)}
        >
          <Text style={styles.bannerTextMutual}>
            Guardado mutuamente · Chat extendido 72h ·{' '}
            {extensionsLeft > 0
              ? `${extensionsLeft} extensiones posibles`
              : 'Proxima extension sera permanente'}
            {'  '}
            <Text style={styles.bannerShare}>Compartir →</Text>
          </Text>
        </TouchableOpacity>
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
            Esta conexion vale la pena? Guardala antes de que expire.
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
              <Text style={styles.saveBtnText}>{saving ? '...' : 'Guardar'}</Text>
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
          onChangeText={(t) => {
            setDraft(t);
            if (blockedText) setBlockedText(null);
          }}
          placeholder={moderating ? 'Comprobando mensaje...' : 'Escribe algo real...'}
          placeholderTextColor="#444441"
          multiline
          maxLength={500}
          editable={!moderating}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { opacity: draft.trim() && !moderating ? 1 : 0.4 }]}
          onPress={sendMessage}
          disabled={!draft.trim() || moderating}
        >
          <Text style={styles.sendBtnText}>{moderating ? '…' : '↑'}</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL DE COMPARTIR */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={modal.overlay}>
          <View style={modal.container}>

            <Text style={modal.title}>¡Conexion real!</Text>
            <Text style={modal.subtitle}>
              Los dos habeis querido seguir. Comparte este momento.
            </Text>

            {/* Tarjeta que se captura */}
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 1.0 }}
              style={modal.cardWrapper}
            >
              <ShareCard matchId={id ?? 'pulse'} />
            </ViewShot>

            {/* Botones */}
            <TouchableOpacity
              style={modal.shareBtn}
              onPress={shareCard}
              disabled={sharing}
            >
              <Text style={modal.shareBtnText}>
                {sharing ? 'Preparando...' : 'Compartir'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={modal.skipBtn}
              onPress={() => setShowShareModal(false)}
            >
              <Text style={modal.skipText}>Ahora no</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ────────────────────────────────────────────────────────────
// Estilos principales
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16, paddingTop: 48,
    borderBottomWidth: 0.5, borderBottomColor: '#2E2E2C',
  },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back:          { fontSize: 15, color: '#7F77DD' },
  timer:         { fontSize: 13, color: '#5F5E5A' },
  timerUrgent:   { color: '#E05252' },
  permanentText: { fontSize: 13, color: '#1D9E75', fontWeight: '500' },

  saveBtn: {
    backgroundColor: '#1D1D3A', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 0.5, borderColor: '#7F77DD',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { fontSize: 13, color: '#7F77DD', fontWeight: '500' },
  savedText:       { fontSize: 13, color: '#1D9E75', fontWeight: '500' },

  messageList: { padding: 16, gap: 12 },
  bubble:      { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleOwn:   { backgroundColor: '#7F77DD', alignSelf: 'flex-end',  borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1A1A18', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText:  { fontSize: 15, lineHeight: 22 },

  banner:               { padding: 12, borderTopWidth: 0.5 },
  bannerBlocked:        { backgroundColor: '#2A1A1A', borderTopColor: '#E05252' },
  bannerTextBlocked:    { fontSize: 13, color: '#E05252', textAlign: 'center' },
  bannerSave:           { backgroundColor: '#1D1D3A', borderTopColor: '#7F77DD' },
  bannerTextSave:       { fontSize: 13, color: '#7F77DD', textAlign: 'center' },
  bannerWaiting:        { backgroundColor: '#1A1A18', borderTopColor: '#5F5E5A' },
  bannerTextWaiting:    { fontSize: 13, color: '#8F8E8A', textAlign: 'center' },
  bannerMutual:         { backgroundColor: '#1A2A1A', borderTopColor: '#1D9E75' },
  bannerTextMutual:     { fontSize: 13, color: '#1D9E75', textAlign: 'center' },
  bannerShare:          { color: '#7F77DD', fontWeight: '500' },
  bannerPermanent:      { backgroundColor: '#1A2A1A', borderTopColor: '#1D9E75' },
  bannerTextPermanent:  { fontSize: 13, color: '#1D9E75', textAlign: 'center', fontWeight: '500' },
  bannerInfo:           { backgroundColor: '#1A1A18', borderTopColor: '#2E2E2C' },
  bannerTextInfo:       { fontSize: 13, color: '#5F5E5A', textAlign: 'center' },

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

// ────────────────────────────────────────────────────────────
// Estilos modal
// ────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  container: {
    backgroundColor: '#1A1A18', borderRadius: 24,
    padding: 24, alignItems: 'center', gap: 16,
    borderWidth: 0.5, borderColor: '#2E2E2C', width: '100%',
  },
  title:    { fontSize: 22, fontWeight: '500', color: '#F0F0EE' },
  subtitle: { fontSize: 14, color: '#8F8E8A', textAlign: 'center', lineHeight: 20 },

  cardWrapper: { borderRadius: 24, overflow: 'hidden' },

  shareBtn: {
    backgroundColor: '#7F77DD', borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 14,
    width: '100%', alignItems: 'center',
  },
  shareBtnText: { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },

  skipBtn:  { paddingVertical: 8 },
  skipText: { fontSize: 14, color: '#444441' },
});

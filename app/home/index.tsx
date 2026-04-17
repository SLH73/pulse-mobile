import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

// ────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────

interface Match {
  match_id: string;
  match_user_id: string;
  expires_at: string;
  saved_by_me: boolean;
  match_profile?: {
    depth_score: number;
    city: string | null;
    created_at: string;
  };
}

interface UserData {
  daily_mood:           string | null;
  mood_updated_at:      string | null;
  last_identity_review: string | null;
  created_at:           string;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const REVIEW_INTERVAL_DAYS = 90;

function hoursUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 3_600_000));
}

function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
}

function moodIsFromToday(updatedAt: string | null): boolean {
  if (!updatedAt) return false;
  const updated = new Date(updatedAt);
  const now     = new Date();
  return (
    updated.getFullYear() === now.getFullYear() &&
    updated.getMonth()    === now.getMonth()    &&
    updated.getDate()     === now.getDate()
  );
}

function moodLabel(mood: string | null): string {
  if (mood === 'listen') return '👂 Necesito escuchar';
  if (mood === 'talk')   return '💬 Quiero hablar';
  if (mood === 'rest')   return '🌙 Solo estar';
  return '';
}

// ¿Necesita revisión de identidad?
// Sí si han pasado 90+ días desde el onboarding o la última revisión
function needsIdentityReview(userData: UserData): boolean {
  const referenceDate = userData.last_identity_review ?? userData.created_at;
  if (!referenceDate) return false;
  const daysSince = (Date.now() - new Date(referenceDate).getTime()) / 86_400_000;
  return daysSince >= REVIEW_INTERVAL_DAYS;
}

// ────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();

  const [loading, setLoading]     = useState(true);
  const [match, setMatch]         = useState<Match | null>(null);
  const [hoursLeft, setHoursLeft] = useState(0);
  const [error, setError]         = useState('');
  const [mood, setMood]           = useState<string | null>(null);

  useEffect(() => {
    checkAndLoad();
  }, []);

  useEffect(() => {
    if (!match) return;
    const interval = setInterval(() => {
      setHoursLeft(hoursUntil(match.expires_at));
    }, 60_000);
    return () => clearInterval(interval);
  }, [match]);

  // ── Orden de comprobaciones al abrir home ────────────────
  // 1. ¿Necesita revisión de identidad? → /review
  // 2. ¿Tiene mood de hoy?              → /mood
  // 3. Todo OK                          → cargar match
  const checkAndLoad = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login'); return; }

      const { data: userData } = await supabase
        .from('users')
        .select('daily_mood, mood_updated_at, last_identity_review, created_at')
        .eq('id', user.id)
        .single();

      const ud = userData as UserData | null;

      // 1. Revisión de identidad pendiente (90 días)
      if (ud && needsIdentityReview(ud)) {
        router.replace('/review');
        return;
      }

      // 2. Mood del día no registrado
      if (!moodIsFromToday(ud?.mood_updated_at ?? null)) {
        router.replace('/mood');
        return;
      }

      // 3. Todo OK — mostrar home con mood
      setMood(ud?.daily_mood ?? null);
      await loadMatch(user.id);

    } catch (e: any) {
      setError('Error cargando datos: ' + e.message);
      setLoading(false);
    }
  };

  // ── Cargar match del día ─────────────────────────────────
  const loadMatch = async (userId?: string) => {
    try {
      let uid = userId;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/auth/login'); return; }
        uid = user.id;
      }

      // FIX BUG-008: query directa con ORDER BY created_at DESC y filtro expires_at > NOW()
      // garantiza que ambos usuarios del match obtengan el mismo match_id
      const now = new Date().toISOString();
      const { data: matchRow, error } = await supabase
        .from('daily_matches')
        .select('id, user_a, user_b, expires_at, saved_by_a, saved_by_b, mutual_save_count')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .or(`expires_at.gt.${now},expires_at.is.null`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (matchRow) {
        const iAmA       = matchRow.user_a === uid;
        const matchUid   = iAmA ? matchRow.user_b : matchRow.user_a;
        const savedByMe  = iAmA ? matchRow.saved_by_a : matchRow.saved_by_b;

        const { data: profile } = await supabase
          .from('users')
          .select('depth_score, city, created_at')
          .eq('id', matchUid)
          .single();

        setMatch({
          match_id:      matchRow.id,
          match_user_id: matchUid,
          expires_at:    matchRow.expires_at,
          saved_by_me:   savedByMe,
          match_profile: profile ?? {
            depth_score: 0,
            city:        null,
            created_at:  new Date().toISOString(),
          },
        });
        setHoursLeft(hoursUntil(matchRow.expires_at));
      }
    } catch (e: any) {
      setError('Error cargando el match: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const changeMood = () => router.push('/mood');

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#7F77DD" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      {/* CABECERA */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Tu conexión de hoy</Text>
        <Text style={styles.title}>Pulse</Text>

        {mood && (
          <TouchableOpacity style={styles.moodBadge} onPress={changeMood}>
            <Text style={styles.moodBadgeText}>{moodLabel(mood)}</Text>
            <Text style={styles.moodBadgeChange}>Cambiar</Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* MATCH CARD */}
      {match ? (
        <View style={styles.matchCard}>
          <Text style={styles.matchLabel}>Alguien te está esperando</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{match.match_profile?.depth_score ?? 0}</Text>
              <Text style={styles.statLabel}>profundidad</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{match.match_profile?.city ?? '—'}</Text>
              <Text style={styles.statLabel}>ciudad</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {match.match_profile?.created_at
                  ? formatMemberSince(match.match_profile.created_at)
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>miembro desde</Text>
            </View>
          </View>

          <View style={[
            styles.timerRow,
            { backgroundColor: hoursLeft < 6 ? '#2A1010' : '#1A1A18' },
          ]}>
            <Text style={[
              styles.timerText,
              { color: hoursLeft < 6 ? '#E24B4A' : '#5F5E5A' },
            ]}>
              {hoursLeft}h restantes
            </Text>
          </View>

          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.push(`/chat/${match.match_id}`)}
          >
            <Text style={styles.startBtnText}>Empezar conversación</Text>
          </TouchableOpacity>
        </View>

      ) : (
        <View style={styles.noMatchCard}>
          <Text style={styles.noMatchTitle}>Tu Pulse llega a las 18:00</Text>
          <Text style={styles.noMatchSubtitle}>
            Cada día conectamos a las personas en el momento{'\n'}
            en que más lo necesitan. Vuelve esta tarde.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadMatch()}>
            <Text style={styles.retryText}>Buscar conexión</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => router.push('/contacts')}>
          <Text style={styles.footerLink}>Contactos</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/capsule')}>
          <Text style={styles.footerLink}>Cápsula</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Text style={styles.footerLink}>Perfil</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────
// Estilos
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader:    { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll:    { padding: 24, paddingBottom: 48 },

  header:   { marginBottom: 32, gap: 8 },
  greeting: { fontSize: 13, color: '#5F5E5A' },
  title:    { fontSize: 32, fontWeight: '500', color: '#F0F0EE' },

  moodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A1A18', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 0.5, borderColor: '#2E2E2C',
    alignSelf: 'flex-start',
  },
  moodBadgeText:   { fontSize: 13, color: '#F0F0EE' },
  moodBadgeChange: { fontSize: 12, color: '#5F5E5A' },

  errorText: { fontSize: 13, color: '#E24B4A', marginBottom: 16 },

  matchCard: {
    backgroundColor: '#1A1A18', borderRadius: 16,
    padding: 24, borderWidth: 0.5, borderColor: '#2E2E2C', marginBottom: 24,
  },
  matchLabel: { fontSize: 13, color: '#7F77DD', fontWeight: '500', marginBottom: 20 },
  statsRow:   { flexDirection: 'row', gap: 12, marginBottom: 20 },
  stat: {
    flex: 1, backgroundColor: '#0D0D0D',
    borderRadius: 10, padding: 12,
  },
  statValue:    { fontSize: 15, fontWeight: '500', color: '#F0F0EE', marginBottom: 4 },
  statLabel:    { fontSize: 11, color: '#5F5E5A' },
  timerRow:     { borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 20 },
  timerText:    { fontSize: 13, fontWeight: '500' },
  startBtn:     { backgroundColor: '#7F77DD', borderRadius: 12, padding: 16, alignItems: 'center' },
  startBtnText: { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },

  noMatchCard: {
    backgroundColor: '#1A1A18', borderRadius: 16, padding: 32,
    alignItems: 'center', borderWidth: 0.5, borderColor: '#2E2E2C', marginBottom: 24,
  },
  noMatchTitle:    { fontSize: 20, fontWeight: '500', color: '#F0F0EE', marginBottom: 12, textAlign: 'center' },
  noMatchSubtitle: { fontSize: 15, color: '#5F5E5A', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  retryBtn: {
    backgroundColor: '#1D1D3A', borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: '#7F77DD',
  },
  retryText: { fontSize: 14, color: '#7F77DD' },

  footer:     { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 8 },
  footerLink: { fontSize: 14, color: '#5F5E5A' },
});

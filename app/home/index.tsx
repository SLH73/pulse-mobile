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

function hoursUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 3_600_000));
}

function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
}

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [hoursLeft, setHoursLeft] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMatch();
  }, []);

  useEffect(() => {
    if (!match) return;
    const interval = setInterval(() => {
      setHoursLeft(hoursUntil(match.expires_at));
    }, 60_000);
    return () => clearInterval(interval);
  }, [match]);

  const loadMatch = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/login');
        return;
      }

      // Llamar a la función de Supabase
      const { data, error } = await supabase
        .rpc('get_today_match', { p_user_id: user.id });

      if (error) throw error;

      if (data && data.length > 0) {
        const matchData = data[0];

        // Obtener perfil del match
        const { data: profile } = await supabase
          .from('users')
          .select('depth_score, city, created_at')
          .eq('id', matchData.match_user_id)
          .single();

        setMatch({
          ...matchData,
          match_profile: profile ?? {
            depth_score: 0,
            city: null,
            created_at: new Date().toISOString(),
          },
        });
        setHoursLeft(hoursUntil(matchData.expires_at));
      }
    } catch (e: any) {
      setError('Error cargando el match: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#7F77DD" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      <View style={styles.header}>
        <Text style={styles.greeting}>Tu conexión de hoy</Text>
        <Text style={styles.title}>Pulse</Text>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {match ? (
        <View style={styles.matchCard}>
          <Text style={styles.matchLabel}>Alguien te está esperando</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {match.match_profile?.depth_score ?? 0}
              </Text>
              <Text style={styles.statLabel}>profundidad</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {match.match_profile?.city ?? '—'}
              </Text>
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
            { backgroundColor: hoursLeft < 6 ? '#2A1010' : '#1A1A18' }
          ]}>
            <Text style={[
              styles.timerText,
              { color: hoursLeft < 6 ? '#E24B4A' : '#5F5E5A' }
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
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={loadMatch}
          >
            <Text style={styles.retryText}>Buscar conexión</Text>
          </TouchableOpacity>
        </View>
      )}

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

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { marginBottom: 32 },
  greeting: { fontSize: 13, color: '#5F5E5A', marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '500', color: '#F0F0EE' },
  errorText: { fontSize: 13, color: '#E24B4A', marginBottom: 16 },
  matchCard: {
    backgroundColor: '#1A1A18', borderRadius: 16,
    padding: 24, borderWidth: 0.5, borderColor: '#2E2E2C', marginBottom: 24,
  },
  matchLabel: { fontSize: 13, color: '#7F77DD', fontWeight: '500', marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  stat: { flex: 1, backgroundColor: '#0D0D0D', borderRadius: 10, padding: 12 },
  statValue: { fontSize: 15, fontWeight: '500', color: '#F0F0EE', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#5F5E5A' },
  timerRow: { borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 20 },
  timerText: { fontSize: 13, fontWeight: '500' },
  startBtn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 16, alignItems: 'center' },
  startBtnText: { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },
  noMatchCard: {
    backgroundColor: '#1A1A18', borderRadius: 16, padding: 32,
    alignItems: 'center', borderWidth: 0.5, borderColor: '#2E2E2C', marginBottom: 24,
  },
  noMatchTitle: { fontSize: 20, fontWeight: '500', color: '#F0F0EE', marginBottom: 12, textAlign: 'center' },
  noMatchSubtitle: { fontSize: 15, color: '#5F5E5A', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  retryBtn: { backgroundColor: '#1D1D3A', borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: '#7F77DD' },
  retryText: { fontSize: 14, color: '#7F77DD' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 8 },
  footerLink: { fontSize: 14, color: '#5F5E5A' },
});
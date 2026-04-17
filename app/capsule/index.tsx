import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

interface Capsule {
  id: string;
  week_start: string;
  conversations: number;
  saved_contacts: number;
  depth_delta: number;
}

function seededRandom(seed: string, index: number): number {
  let h = 0;
  const str = seed + index;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 1000) / 1000;
}

function CapsuleVisual({ seed, conversations }: { seed: string; conversations: number }) {
  const baseHue = Math.floor(seededRandom(seed, 0) * 360);
  const circles = Array.from({ length: Math.min(conversations, 6) }, (_, i) => ({
    size:    20 + seededRandom(seed, i + 1) * 40,
    x:       10 + seededRandom(seed, i + 10) * 80,
    y:       10 + seededRandom(seed, i + 20) * 80,
    hue:     (baseHue + i * 40) % 360,
    opacity: 0.3 + seededRandom(seed, i + 30) * 0.5,
  }));

  return (
    <View style={visual.container}>
      {circles.map((c, i) => (
        <View
          key={i}
          style={[
            visual.circle,
            {
              width: c.size, height: c.size, borderRadius: c.size / 2,
              backgroundColor: `hsl(${c.hue}, 60%, 55%)`,
              opacity: c.opacity, left: `${c.x}%`, top: `${c.y}%`,
            },
          ]}
        />
      ))}
    </View>
  );
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
}

export default function CapsuleScreen() {
  const router = useRouter();
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    loadCapsules();
  }, []);

  // FIX BUG-013: query filtrada por user_id — nunca muestra datos de otros usuarios
  const loadCapsules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login'); return; }

      const { data, error } = await supabase
        .from('weekly_capsules')
        .select('id, week_start, conversations, saved_contacts, depth_delta')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(4);

      // PGRST205: tabla aún no existe — mostrar estado vacío sin error
      if (error && error.code !== 'PGRST205') throw error;
      setCapsules(data ?? []);
    } catch (e) {
      console.error('Error cargando cápsulas:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (capsule: Capsule) => {
    await Share.share({
      message: `Mi semana en Pulse: ${capsule.conversations} conversaciones, ${capsule.saved_contacts} conexiones. pulseapp.es`,
    });
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#7F77DD" size="large" />
      </View>
    );
  }

  if (capsules.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Cápsula</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aún no hay cápsulas</Text>
          <Text style={styles.emptySubtitle}>
            Cada semana generamos una cápsula con el resumen de tus conexiones.
            Vuelve el lunes.
          </Text>
        </View>
        <Text style={styles.backText} onPress={() => router.back()}>Volver</Text>
      </ScrollView>
    );
  }

  const capsule = capsules[selected];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Cápsula</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
        {capsules.map((c, i) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.weekPill, { backgroundColor: i === selected ? '#7F77DD' : '#1A1A18' }]}
            onPress={() => setSelected(i)}
          >
            <Text style={[styles.weekPillText, { color: i === selected ? '#0D0D0D' : '#5F5E5A' }]}>
              {formatWeek(c.week_start)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Semana del {formatWeek(capsule.week_start)}</Text>
        <CapsuleVisual seed={capsule.id} conversations={capsule.conversations} />
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{capsule.conversations}</Text>
            <Text style={styles.statLabel}>conversaciones</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{capsule.saved_contacts}</Text>
            <Text style={styles.statLabel}>conexiones</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>+{capsule.depth_delta}</Text>
            <Text style={styles.statLabel}>profundidad</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(capsule)}>
          <Text style={styles.shareBtnText}>Compartir cápsula</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.backText} onPress={() => router.back()}>Volver</Text>
    </ScrollView>
  );
}

const visual = StyleSheet.create({
  container: {
    width: '100%', height: 200, backgroundColor: '#0D0D0D',
    borderRadius: 12, overflow: 'hidden', marginBottom: 20, position: 'relative',
  },
  circle: { position: 'absolute' },
});

const styles = StyleSheet.create({
  loader:       { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  container:    { flex: 1, backgroundColor: '#0D0D0D' },
  scroll:       { padding: 24, paddingTop: 48, paddingBottom: 48 },
  title:        { fontSize: 28, fontWeight: '500', color: '#F0F0EE', marginBottom: 20 },
  weekScroll:   { marginBottom: 20 },
  weekPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
    marginRight: 8, borderWidth: 0.5, borderColor: '#2E2E2C',
  },
  weekPillText: { fontSize: 13, fontWeight: '500' },
  card: {
    backgroundColor: '#1A1A18', borderRadius: 16, padding: 20,
    borderWidth: 0.5, borderColor: '#2E2E2C', marginBottom: 24,
  },
  cardLabel:    { fontSize: 13, color: '#5F5E5A', marginBottom: 16 },
  statsRow:     { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat:         { flex: 1, backgroundColor: '#0D0D0D', borderRadius: 10, padding: 12 },
  statValue:    { fontSize: 20, fontWeight: '500', color: '#F0F0EE', marginBottom: 4 },
  statLabel:    { fontSize: 11, color: '#5F5E5A' },
  shareBtn: {
    backgroundColor: '#1D1D3A', borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 12, borderWidth: 0.5, borderColor: '#7F77DD',
  },
  shareBtnText: { fontSize: 15, color: '#7F77DD', fontWeight: '500' },
  emptyCard: {
    backgroundColor: '#1A1A18', borderRadius: 16, padding: 32,
    alignItems: 'center', borderWidth: 0.5, borderColor: '#2E2E2C', marginBottom: 24,
  },
  emptyTitle:    { fontSize: 18, fontWeight: '500', color: '#F0F0EE', marginBottom: 12, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#5F5E5A', textAlign: 'center', lineHeight: 22 },
  backText:      { fontSize: 15, color: '#7F77DD', marginTop: 8 },
});

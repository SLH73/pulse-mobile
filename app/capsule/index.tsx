import React from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MOCK_CAPSULES = [
  { id: '1', week_start: '2026-04-07', conversations: 5, saved_contacts: 2, depth_delta: 2, seed: 'a1b2c3' },
  { id: '2', week_start: '2026-03-31', conversations: 3, saved_contacts: 1, depth_delta: 1, seed: 'd4e5f6' },
  { id: '3', week_start: '2026-03-24', conversations: 7, saved_contacts: 3, depth_delta: 3, seed: 'g7h8i9' },
];

function seededRandom(seed: string, index: number): number {
  let h = 0;
  const str = seed + index;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 1000) / 1000;
}

function CapsuleVisual({ seed, conversations, savedContacts }: { seed: string; conversations: number; savedContacts: number; }) {
  const baseHue = Math.floor(seededRandom(seed, 0) * 360);
  const circles = Array.from({ length: Math.min(conversations, 6) }, (_, i) => ({
    size: 20 + seededRandom(seed, i + 1) * 40,
    x: 10 + seededRandom(seed, i + 10) * 80,
    y: 10 + seededRandom(seed, i + 20) * 80,
    hue: (baseHue + i * 40) % 360,
    opacity: 0.3 + seededRandom(seed, i + 30) * 0.5,
  }));

  return (
    <View style={visual.container}>
      {circles.map((c, i) => (
        <View key={i} style={[visual.circle, { width: c.size, height: c.size, borderRadius: c.size / 2, backgroundColor: `hsl(${c.hue}, 60%, 55%)`, opacity: c.opacity, left: `${c.x}%`, top: `${c.y}%` }]} />
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
  const [selected, setSelected] = React.useState(0);
  const capsule = MOCK_CAPSULES[selected];

  const handleShare = async () => {
    await Share.share({
      message: `Mi semana en Pulse: ${capsule.conversations} conversaciones, ${capsule.saved_contacts} conexiones. pulse.app`,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Capsula</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
        {MOCK_CAPSULES.map((c, i) => (
          <View key={c.id} style={[styles.weekPill, { backgroundColor: i === selected ? '#7F77DD' : '#1A1A18' }]}>
            <Text style={[styles.weekPillText, { color: i === selected ? '#0D0D0D' : '#5F5E5A' }]} onPress={() => setSelected(i)}>
              {formatWeek(c.week_start)}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Semana del {formatWeek(capsule.week_start)}</Text>
        <CapsuleVisual seed={capsule.seed} conversations={capsule.conversations} savedContacts={capsule.saved_contacts} />
        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statValue}>{capsule.conversations}</Text><Text style={styles.statLabel}>conversaciones</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{capsule.saved_contacts}</Text><Text style={styles.statLabel}>conexiones</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>+{capsule.depth_delta}</Text><Text style={styles.statLabel}>profundidad</Text></View>
        </View>
        <View style={styles.shareBtn} onTouchEnd={handleShare}><Text style={styles.shareBtnText}>Compartir capsula</Text></View>
      </View>
      <Text style={styles.backText} onPress={() => router.back()}>Volver</Text>
    </ScrollView>
  );
}

const visual = StyleSheet.create({
  container: { width: '100%', height: 200, backgroundColor: '#0D0D0D', borderRadius: 12, overflow: 'hidden', marginBottom: 20, position: 'relative' },
  circle: { position: 'absolute' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '500', color: '#F0F0EE', marginBottom: 20 },
  weekScroll: { marginBottom: 20 },
  weekPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, marginRight: 8, borderWidth: 0.5, borderColor: '#2E2E2C' },
  weekPillText: { fontSize: 13, fontWeight: '500' },
  card: { backgroundColor: '#1A1A18', borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: '#2E2E2C', marginBottom: 24 },
  cardLabel: { fontSize: 13, color: '#5F5E5A', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: '#0D0D0D', borderRadius: 10, padding: 12 },
  statValue: { fontSize: 20, fontWeight: '500', color: '#F0F0EE', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#5F5E5A' },
  shareBtn: { backgroundColor: '#1D1D3A', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12, borderWidth: 0.5, borderColor: '#7F77DD' },
  shareBtnText: { fontSize: 15, color: '#7F77DD', fontWeight: '500' },
  backText: { fontSize: 15, color: '#7F77DD', marginTop: 8 },
});
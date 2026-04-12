import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MOCK_CONTACTS = [
  { id: '1', hue: 120, symbol: '◆', depth: 5, city: 'Madrid', saved_at: 'hace 2 días' },
  { id: '2', hue: 200, symbol: '●', depth: 3, city: 'Barcelona', saved_at: 'hace 5 días' },
  { id: '3', hue: 40,  symbol: '▲', depth: 8, city: 'Madrid', saved_at: 'hace 1 semana' },
];

export default function ContactsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Contactos</Text>
      <Text style={styles.subtitle}>{MOCK_CONTACTS.length} conexiones guardadas</Text>

      {MOCK_CONTACTS.map(c => (
        <TouchableOpacity
          key={c.id}
          style={styles.row}
          onPress={() => router.push(`/chat/${c.id}`)}
        >
          <View style={[styles.avatar, { backgroundColor: `hsl(${c.hue}, 60%, 20%)` }]}>
            <Text style={[styles.avatarSymbol, { color: `hsl(${c.hue}, 60%, 65%)` }]}>
              {c.symbol}
            </Text>
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.depthText}>{c.depth} profundidad · {c.city}</Text>
            <Text style={styles.savedAt}>Guardado {c.saved_at}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { padding: 24, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: '500', color: '#F0F0EE', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#5F5E5A', marginBottom: 32 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingVertical: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#2E2E2C',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSymbol: { fontSize: 20 },
  rowInfo: { flex: 1 },
  depthText: { fontSize: 15, color: '#F0F0EE', marginBottom: 3 },
  savedAt: { fontSize: 12, color: '#5F5E5A' },
  arrow: { fontSize: 22, color: '#2E2E2C' },
  backBtn: { marginTop: 32 },
  backText: { fontSize: 15, color: '#7F77DD' },
});
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

interface Contact {
  id: string;
  contact_id: string;
  match_id: string;
  saved_at: string;
  contact_profile: {
    depth_score: number;
    city: string | null;
  } | null;
}

const DEPTH_LEVELS = [
  { min: 0,  label: 'Explorando' },
  { min: 3,  label: 'Conectando' },
  { min: 8,  label: 'Profundo'   },
  { min: 15, label: 'Muy profundo' },
  { min: 25, label: 'Esencial'   },
];

function depthLabel(score: number): string {
  return [...DEPTH_LEVELS].reverse().find(l => score >= l.min)?.label ?? 'Explorando';
}

// FIX BUG-010: color determinista a partir del contact_id para el avatar generativo
function seedToHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function AvatarCircle({ contactId }: { contactId: string }) {
  const hue     = seedToHue(contactId);
  const bgColor = `hsl(${hue}, 45%, 22%)`;
  const fgColor = `hsl(${hue}, 60%, 65%)`;
  return (
    <View style={[s.avatar, { backgroundColor: bgColor }]}>
      <Text style={[s.avatarSymbol, { color: fgColor }]}>✦</Text>
    </View>
  );
}

export default function ContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  // FIX BUG-011: JOIN con users para mostrar datos del contacto en lugar de texto fijo
  const loadContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('saved_contacts')
      .select('id, contact_id, match_id, saved_at, contact_profile:users!contact_id(depth_score, city)')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false });

    setContacts((data ?? []) as Contact[]);
    setLoading(false);
  };

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color="#7F77DD" /></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scroll}>
      <Text style={s.title}>Contactos</Text>
      <Text style={s.subtitle}>{contacts.length} conexiones guardadas</Text>

      {contacts.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Aún no hay nadie aquí</Text>
          <Text style={s.emptyText}>Pulsa Guardar en el chat para añadir conexiones.</Text>
        </View>
      ) : (
        contacts.map(c => {
          const profile  = c.contact_profile;
          const label    = profile ? depthLabel(profile.depth_score) : 'Conexión';
          const sublabel = profile?.city ? profile.city : new Date(c.saved_at).toLocaleDateString('es');
          return (
            <TouchableOpacity key={c.id} style={s.row} onPress={() => router.push(`/chat/${c.match_id}`)}>
              <AvatarCircle contactId={c.contact_id} />
              <View style={s.info}>
                <Text style={s.name}>{label}</Text>
                <Text style={s.date}>{sublabel}</Text>
              </View>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity style={s.back} onPress={() => router.back()}>
        <Text style={s.backText}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  loader:    { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll:    { padding: 24, paddingTop: 48, paddingBottom: 48 },
  title:     { fontSize: 28, fontWeight: '500', color: '#F0F0EE', marginBottom: 4 },
  subtitle:  { fontSize: 13, color: '#5F5E5A', marginBottom: 32 },
  empty: {
    backgroundColor: '#1A1A18', borderRadius: 16, padding: 32,
    alignItems: 'center', borderWidth: 0.5, borderColor: '#2E2E2C',
  },
  emptyTitle: { fontSize: 18, fontWeight: '500', color: '#F0F0EE', marginBottom: 12 },
  emptyText:  { fontSize: 14, color: '#5F5E5A', textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#2E2E2C',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSymbol: { fontSize: 20 },
  info:   { flex: 1 },
  name:   { fontSize: 15, color: '#F0F0EE', marginBottom: 3 },
  date:   { fontSize: 12, color: '#5F5E5A' },
  arrow:  { fontSize: 22, color: '#2E2E2C' },
  back:   { marginTop: 32 },
  backText: { fontSize: 15, color: '#7F77DD' },
});

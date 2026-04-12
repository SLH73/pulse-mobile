import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function ContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('saved_contacts')
      .select('id, contact_id, match_id, saved_at')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false });

    setContacts(data ?? []);
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
          <Text style={s.emptyTitle}>Aun no hay nadie aqui</Text>
          <Text style={s.emptyText}>Pulsa Guardar en el chat para añadir conexiones.</Text>
        </View>
      ) : (
        contacts.map(c => (
          <TouchableOpacity key={c.id} style={s.row} onPress={() => router.push(`/chat/${c.match_id}`)}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>*</Text>
            </View>
            <View style={s.info}>
              <Text style={s.name}>Conexion guardada</Text>
              <Text style={s.date}>{new Date(c.saved_at).toLocaleDateString('es')}</Text>
            </View>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity style={s.back} onPress={() => router.back()}>
        <Text style={s.backText}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  loader: { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '500', color: '#F0F0EE', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#5F5E5A', marginBottom: 32 },
  empty: { backgroundColor: '#1A1A18', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 0.5, borderColor: '#2E2E2C' },
  emptyTitle: { fontSize: 18, fontWeight: '500', color: '#F0F0EE', marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#5F5E5A', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#2E2E2C' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1D1D3A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, color: '#7F77DD' },
  info: { flex: 1 },
  name: { fontSize: 15, color: '#F0F0EE', marginBottom: 3 },
  date: { fontSize: 12, color: '#5F5E5A' },
  arrow: { fontSize: 22, color: '#2E2E2C' },
  back: { marginTop: 32 },
  backText: { fontSize: 15, color: '#7F77DD' },
});
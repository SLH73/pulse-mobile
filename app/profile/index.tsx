import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@pulseapp.es';

const DEPTH_LEVELS = [
  { min: 0,  label: 'Explorando',   color: '#888780' },
  { min: 3,  label: 'Conectando',   color: '#1D9E75' },
  { min: 8,  label: 'Profundo',     color: '#7F77DD' },
  { min: 15, label: 'Muy profundo', color: '#534AB7' },
  { min: 25, label: 'Esencial',     color: '#3C3489' },
];

function getLevel(score: number) {
  return [...DEPTH_LEVELS].reverse().find(l => score >= l.min) ?? DEPTH_LEVELS[0];
}

const MOCK_PROFILE = {
  depth_score:         5,
  city:                'Madrid',
  total_contacts:      3,
  total_conversations: 8,
  member_since:        'abril 2026',
};

// ────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router   = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  const level    = getLevel(MOCK_PROFILE.depth_score);
  const progress = Math.min(MOCK_PROFILE.depth_score / 30, 1);

  // Detectar si el usuario actual es admin
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email === ADMIN_EMAIL) setIsAdmin(true);
    });
  }, []);

  // ── Acciones ─────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/auth/login');
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Eliminar cuenta',
      'Esta accion es irreversible. Se eliminaran todos tus datos permanentemente en 30 dias. Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              await supabase
                .from('users')
                .update({ deletion_requested_at: new Date().toISOString() })
                .eq('id', user.id);
              await supabase.auth.signOut();
              router.replace('/auth/login');
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la cuenta. Intenta de nuevo.');
            }
          },
        },
      ]
    );
  };

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Perfil</Text>

      {/* HERO */}
      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarSymbol}>✦</Text>
        </View>
        <Text style={[styles.levelText, { color: level.color }]}>{level.label}</Text>
        <Text style={styles.depthScore}>{MOCK_PROFILE.depth_score}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: level.color }]} />
        </View>
        <Text style={styles.hint}>Cada conexion guardada suma un punto</Text>
        <Text style={styles.memberSince}>En Pulse desde {MOCK_PROFILE.member_since}</Text>
      </View>

      {/* STATS */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{MOCK_PROFILE.total_conversations}</Text>
          <Text style={styles.statLabel}>conversaciones</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{MOCK_PROFILE.total_contacts}</Text>
          <Text style={styles.statLabel}>contactos</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{MOCK_PROFILE.city}</Text>
          <Text style={styles.statLabel}>ciudad</Text>
        </View>
      </View>

      {/* ACCIONES */}
      <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/contacts')}>
        <Text style={styles.actionText}>Ver contactos</Text>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/capsule')}>
        <Text style={styles.actionText}>Mi capsula semanal</Text>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/legal/privacy')}>
        <Text style={styles.actionText}>Politica de privacidad</Text>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionRow} onPress={handleDeleteAccount}>
        <Text style={[styles.actionText, { color: '#E24B4A' }]}>Eliminar mi cuenta</Text>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionRow} onPress={handleSignOut}>
        <Text style={[styles.actionText, { color: '#E24B4A' }]}>Cerrar sesion</Text>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      {/* ENLACE ADMIN — solo visible para admin@pulseapp.es */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.adminRow}
          onPress={() => router.push('/admin')}
        >
          <Text style={styles.adminText}>Panel de administracion</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────
// Estilos
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0D0D0D' },
  scroll:       { padding: 24, paddingTop: 48, paddingBottom: 48 },
  title:        { fontSize: 28, fontWeight: '500', color: '#F0F0EE', marginBottom: 24 },

  heroCard: {
    backgroundColor: '#1A1A18', borderRadius: 16,
    padding: 24, alignItems: 'center',
    borderWidth: 0.5, borderColor: '#2E2E2C', marginBottom: 16,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#EEEDFE', alignItems: 'center',
    justifyContent: 'center', marginBottom: 12,
  },
  avatarSymbol: { fontSize: 32, color: '#534AB7' },
  levelText:    { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  depthScore:   { fontSize: 36, fontWeight: '500', color: '#F0F0EE', marginBottom: 12 },
  track: {
    width: '100%', height: 6, backgroundColor: '#2E2E2C',
    borderRadius: 99, overflow: 'hidden', marginBottom: 8,
  },
  fill:         { height: '100%', borderRadius: 99 },
  hint:         { fontSize: 12, color: '#5F5E5A', marginBottom: 4 },
  memberSince:  { fontSize: 12, color: '#444441' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  stat: {
    flex: 1, backgroundColor: '#1A1A18',
    borderRadius: 12, padding: 14,
    borderWidth: 0.5, borderColor: '#2E2E2C',
  },
  statValue: { fontSize: 18, fontWeight: '500', color: '#F0F0EE', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#5F5E5A' },

  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#2E2E2C',
  },
  actionText:  { fontSize: 15, color: '#F0F0EE' },
  actionArrow: { fontSize: 20, color: '#2E2E2C' },

  // Admin — mismo estilo pero con acento púrpura sutil
  adminRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#2E2E2C',
    marginTop: 8,
  },
  adminText: { fontSize: 15, color: '#7F77DD' },

  backBtn:  { marginTop: 32 },
  backText: { fontSize: 15, color: '#7F77DD' },
});

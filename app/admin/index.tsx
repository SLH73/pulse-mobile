import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
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

interface AdminMetrics {
  dau:            number;
  matches_today:  number;
  pct_chat_open:  number;
  pct_saved:      number;
  new_users_week: number;
  waitlist_count: number;
  flags_pending:  number;
  generated_at:   string;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@pulseapp.es';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', {
    hour: '2-digit', minute: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────
// Sub-componente: tarjeta de métrica
// ────────────────────────────────────────────────────────────

interface MetricCardProps {
  label:    string;
  value:    string | number;
  sublabel?: string;
  alert?:   boolean;  // true = destacar en rojo
  good?:    boolean;  // true = destacar en verde
}

function MetricCard({ label, value, sublabel, alert, good }: MetricCardProps) {
  const valueColor = alert ? '#E24B4A' : good ? '#1D9E75' : '#F0F0EE';
  return (
    <View style={[styles.card, alert && styles.cardAlert]}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color: valueColor }]}>{value}</Text>
      {sublabel ? <Text style={styles.cardSublabel}>{sublabel}</Text> : null}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();

  const [checking, setChecking]   = useState(true);
  const [allowed, setAllowed]     = useState(false);
  const [metrics, setMetrics]     = useState<AdminMetrics | null>(null);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');

  // ── Verificar que es admin ───────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email === ADMIN_EMAIL) {
        setAllowed(true);
        loadMetrics();
      } else {
        setAllowed(false);
      }
      setChecking(false);
    });
  }, []);

  // ── Cargar métricas ──────────────────────────────────────
  const loadMetrics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.rpc('get_admin_metrics');
      if (error) throw error;
      setMetrics(data as AdminMetrics);
    } catch (e: any) {
      setError('Error cargando métricas: ' + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ────────────────────────────────────────────────────────
  // Estados de carga y acceso
  // ────────────────────────────────────────────────────────

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7F77DD" />
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.forbidden}>Acceso restringido</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7F77DD" />
        <Text style={styles.loadingText}>Cargando metricas...</Text>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────
  // Dashboard
  // ────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadMetrics(true)}
          tintColor="#7F77DD"
        />
      }
    >
      {/* CABECERA */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Volver</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>Panel de administracion</Text>
          <Text style={styles.title}>Metricas Pulse</Text>
          {metrics && (
            <Text style={styles.updatedAt}>
              Actualizado a las {formatTime(metrics.generated_at)} · Desliza para refrescar
            </Text>
          )}
        </View>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {metrics && (
        <>
          {/* SECCIÓN: HOY */}
          <Text style={styles.sectionTitle}>Hoy</Text>
          <View style={styles.grid}>
            <MetricCard
              label="Usuarios activos (DAU)"
              value={metrics.dau}
              good={metrics.dau > 0}
            />
            <MetricCard
              label="Matches generados"
              value={metrics.matches_today}
            />
          </View>

          {/* SECCIÓN: CONVERSIÓN */}
          <Text style={styles.sectionTitle}>Conversion</Text>
          <View style={styles.grid}>
            <MetricCard
              label="Matches que abren chat"
              value={`${metrics.pct_chat_open}%`}
              sublabel="Objetivo: >50%"
              good={metrics.pct_chat_open >= 50}
              alert={metrics.pct_chat_open < 20}
            />
            <MetricCard
              label="Chats que guardan contacto"
              value={`${metrics.pct_saved}%`}
              sublabel="Objetivo: >30%"
              good={metrics.pct_saved >= 30}
              alert={metrics.pct_saved < 10}
            />
          </View>

          {/* SECCIÓN: CRECIMIENTO */}
          <Text style={styles.sectionTitle}>Crecimiento</Text>
          <View style={styles.grid}>
            <MetricCard
              label="Nuevos usuarios esta semana"
              value={metrics.new_users_week}
              good={metrics.new_users_week > 0}
            />
            <MetricCard
              label="Lista de espera"
              value={metrics.waitlist_count}
              sublabel="Objetivo: 200 en Madrid"
              good={metrics.waitlist_count >= 200}
            />
          </View>

          {/* SECCIÓN: MODERACIÓN */}
          <Text style={styles.sectionTitle}>Moderacion</Text>
          <View style={styles.grid}>
            <MetricCard
              label="Flags pendientes de revision"
              value={metrics.flags_pending}
              sublabel={metrics.flags_pending > 3 ? '⚠ Revisar urgente' : 'Sin alertas'}
              alert={metrics.flags_pending > 3}
              good={metrics.flags_pending === 0}
            />
          </View>

          {/* BOTÓN REFRESCAR */}
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => loadMetrics(true)}
            disabled={refreshing}
          >
            <Text style={styles.refreshBtnText}>
              {refreshing ? 'Actualizando...' : 'Actualizar metricas'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────
// Estilos
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll:    { padding: 24, paddingBottom: 48 },
  center:    { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center', gap: 16 },

  // Cabecera
  header:    { marginBottom: 32, gap: 4 },
  back:      { fontSize: 15, color: '#7F77DD', marginBottom: 16 },
  eyebrow:   { fontSize: 12, color: '#5F5E5A', letterSpacing: 0.5 },
  title:     { fontSize: 28, fontWeight: '500', color: '#F0F0EE' },
  updatedAt: { fontSize: 12, color: '#444441', marginTop: 4 },

  // Secciones
  sectionTitle: {
    fontSize: 12, color: '#5F5E5A', fontWeight: '500',
    letterSpacing: 0.8, marginBottom: 10, marginTop: 24,
  },

  // Grid de tarjetas
  grid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  card: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#1A1A18', borderRadius: 14,
    padding: 16, borderWidth: 0.5, borderColor: '#2E2E2C',
    gap: 4,
  },
  cardAlert:    { borderColor: '#E24B4A', backgroundColor: '#2A1010' },
  cardLabel:    { fontSize: 12, color: '#5F5E5A' },
  cardValue:    { fontSize: 26, fontWeight: '500' },
  cardSublabel: { fontSize: 11, color: '#444441', marginTop: 2 },

  // Estados
  forbidden:   { fontSize: 18, color: '#5F5E5A', marginBottom: 16 },
  backLink:    { fontSize: 15, color: '#7F77DD' },
  loadingText: { fontSize: 14, color: '#5F5E5A', marginTop: 12 },
  errorText:   { fontSize: 13, color: '#E24B4A', marginBottom: 16 },

  // Botón refrescar
  refreshBtn: {
    marginTop: 32, backgroundColor: '#1D1D3A',
    borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 0.5, borderColor: '#7F77DD',
  },
  refreshBtnText: { fontSize: 14, color: '#7F77DD', fontWeight: '500' },
});

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getIsDeep,
  getOffering,
  purchaseDeep,
  restorePurchases,
} from '../src/lib/revenuecat';

// ────────────────────────────────────────────────────────────
// Beneficios de Pulse Deep
// ────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: '⚡',
    title: 'Hasta 3 conexiones al dia',
    subtitle: 'No te pierdas ninguna conexion importante',
    color: '#7F77DD',
  },
  {
    icon: '🔍',
    title: 'Por que sois compatibles',
    subtitle: 'Explicacion de tu afinidad con cada Pulse',
    color: '#1D9E75',
  },
  {
    icon: '📅',
    title: 'Historial ilimitado de capsulas',
    subtitle: 'Accede a todas tus semanas, no solo las ultimas 4',
    color: '#7F77DD',
  },
  {
    icon: '📊',
    title: 'Estadisticas avanzadas',
    subtitle: 'Analisis profundo de tu DepthMeter y conexiones',
    color: '#1D9E75',
  },
  {
    icon: '✦',
    title: 'Badge Profundo en tu perfil',
    subtitle: 'Visible para las personas con las que conectas',
    color: '#534AB7',
  },
];

// ────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────

export default function DeepScreen() {
  const router = useRouter();

  const [isDeep, setIsDeep]       = useState(false);
  const [price, setPrice]         = useState('4,99€/mes');
  const [loading, setLoading]     = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  // ── Cargar estado y precio real ──────────────────────────
  const loadStatus = async () => {
    setLoading(true);
    try {
      const [deep, offering] = await Promise.all([
        getIsDeep(),
        getOffering(),
      ]);

      setIsDeep(deep);

      // Precio real desde RevenueCat
      if (offering?.monthly?.product?.priceString) {
        setPrice(offering.monthly.product.priceString + '/mes');
      }
    } catch (e) {
      console.error('[deep] error cargando estado:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Comprar ──────────────────────────────────────────────
  const handlePurchase = async () => {
    if (purchasing) return;
    setPurchasing(true);

    const result = await purchaseDeep();
    setPurchasing(false);

    if (result.success && result.isDeep) {
      setIsDeep(true);
      Alert.alert(
        '¡Bienvenido a Pulse Deep!',
        'Ya tienes acceso a todas las funciones premium. Disfruta de tus conexiones.',
        [{ text: 'Empezar', onPress: () => router.back() }]
      );
    } else if (result.error) {
      Alert.alert('Error', result.error);
    }
    // Si el usuario canceló no hacemos nada
  };

  // ── Restaurar compras ────────────────────────────────────
  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);

    const restored = await restorePurchases();
    setRestoring(false);

    if (restored) {
      setIsDeep(true);
      Alert.alert('Compra restaurada', 'Tu suscripcion Pulse Deep ha sido restaurada.');
    } else {
      Alert.alert('Sin compras', 'No encontramos ninguna suscripcion activa para restaurar.');
    }
  };

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
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        <Text style={styles.badge}>✦ PULSE DEEP</Text>
        <Text style={styles.title}>
          {isDeep ? 'Eres Deep' : 'Ve mas alla'}
        </Text>
        <Text style={styles.subtitle}>
          {isDeep
            ? 'Tienes acceso completo a todas las funciones de Pulse Deep.'
            : 'Conexiones mas profundas, mas contexto, mas ti.'}
        </Text>
      </View>

      {/* PRECIO */}
      {!isDeep && (
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Suscripcion mensual</Text>
          <Text style={styles.price}>{price}</Text>
          <Text style={styles.priceSub}>Cancela cuando quieras</Text>
        </View>
      )}

      {/* BENEFICIOS */}
      <Text style={styles.sectionTitle}>
        {isDeep ? 'Tus beneficios activos' : 'Todo lo que incluye'}
      </Text>

      <View style={styles.benefits}>
        {BENEFITS.map((benefit, i) => (
          <View key={i} style={styles.benefitRow}>
            <View style={[styles.benefitIcon, { backgroundColor: benefit.color + '20' }]}>
              <Text style={styles.benefitIconText}>{benefit.icon}</Text>
            </View>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitSubtitle}>{benefit.subtitle}</Text>
            </View>
            {isDeep && <Text style={styles.checkmark}>✓</Text>}
          </View>
        ))}
      </View>

      {/* BOTÓN DE COMPRA */}
      {!isDeep ? (
        <>
          <TouchableOpacity
            style={[styles.purchaseBtn, purchasing && styles.purchaseBtnDisabled]}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            <Text style={styles.purchaseBtnText}>
              {purchasing ? 'Procesando...' : `Activar Pulse Deep — ${price}`}
            </Text>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            La suscripcion se renueva automaticamente cada mes. Puedes cancelar en cualquier
            momento desde los ajustes de tu cuenta de Google Play o App Store.
          </Text>

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={restoring}
          >
            <Text style={styles.restoreText}>
              {restoring ? 'Restaurando...' : 'Restaurar compra anterior'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.activeCard}>
          <Text style={styles.activeText}>✦ Pulse Deep activo</Text>
          <Text style={styles.activeSub}>
            Gracias por ser parte de la profundidad.
          </Text>
        </View>
      )}

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

  backBtn:  { marginBottom: 24 },
  backText: { fontSize: 15, color: '#7F77DD' },

  // Hero
  hero:     { marginBottom: 24, gap: 8 },
  badge: {
    fontSize: 12, color: '#7F77DD', fontWeight: '600',
    letterSpacing: 1.5,
  },
  title:    { fontSize: 32, fontWeight: '500', color: '#F0F0EE' },
  subtitle: { fontSize: 15, color: '#8F8E8A', lineHeight: 22 },

  // Precio
  priceCard: {
    backgroundColor: '#1D1D3A', borderRadius: 16,
    padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#7F77DD',
    marginBottom: 28,
  },
  priceLabel: { fontSize: 12, color: '#7F77DD', letterSpacing: 0.5, marginBottom: 4 },
  price:      { fontSize: 32, fontWeight: '500', color: '#F0F0EE' },
  priceSub:   { fontSize: 12, color: '#5F5E5A', marginTop: 4 },

  // Beneficios
  sectionTitle: {
    fontSize: 12, color: '#5F5E5A', fontWeight: '500',
    letterSpacing: 0.8, marginBottom: 12,
  },
  benefits:     { gap: 12, marginBottom: 28 },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1A1A18', borderRadius: 14,
    padding: 16, borderWidth: 0.5, borderColor: '#2E2E2C',
  },
  benefitIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  benefitIconText: { fontSize: 22 },
  benefitText:     { flex: 1, gap: 2 },
  benefitTitle:    { fontSize: 15, fontWeight: '500', color: '#F0F0EE' },
  benefitSubtitle: { fontSize: 12, color: '#5F5E5A' },
  checkmark:       { fontSize: 16, color: '#1D9E75', fontWeight: '600' },

  // Botón compra
  purchaseBtn: {
    backgroundColor: '#7F77DD', borderRadius: 14,
    padding: 18, alignItems: 'center', marginBottom: 12,
  },
  purchaseBtnDisabled: { opacity: 0.5 },
  purchaseBtnText:     { fontSize: 16, fontWeight: '600', color: '#0D0D0D' },

  legalText: {
    fontSize: 11, color: '#444441', textAlign: 'center',
    lineHeight: 16, marginBottom: 16,
  },

  restoreBtn:  { alignItems: 'center', paddingVertical: 8 },
  restoreText: { fontSize: 13, color: '#5F5E5A' },

  // Estado activo
  activeCard: {
    backgroundColor: '#1A2A1A', borderRadius: 14,
    padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#1D9E75',
  },
  activeText: { fontSize: 18, fontWeight: '500', color: '#1D9E75' },
  activeSub:  { fontSize: 13, color: '#5F5E5A', marginTop: 4 },
});

import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../src/lib/supabase';

// ────────────────────────────────────────────────────────────
// Preguntas de revisión
// Distintas a las 5 originales del onboarding
// ────────────────────────────────────────────────────────────

const REVIEW_QUESTIONS = [
  "¿Que te preocupa ahora mismo que hace 3 meses no te preocupaba?",
  "¿En que has cambiado estos ultimos meses sin que nadie te lo haya dicho?",
];

// ────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────

export default function IdentityReviewScreen() {
  const router = useRouter();

  const [step, setStep]       = useState(0);        // 0 o 1
  const [answers, setAnswers] = useState(['', '']); // respuestas acumuladas
  const [draft, setDraft]     = useState('');
  const [saving, setSaving]   = useState(false);

  // Animación de entrada por paso
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [step]);

  const canContinue = draft.trim().length >= 10;

  // ── Avanzar al siguiente paso ────────────────────────────
  const handleNext = () => {
    if (!canContinue) return;

    const newAnswers = [...answers];
    newAnswers[step] = draft.trim();
    setAnswers(newAnswers);
    setDraft('');

    if (step < REVIEW_QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      // Última pregunta → enviar al engine
      submitReview(newAnswers);
    }
  };

  // ── Enviar revisión al matching engine ───────────────────
  const submitReview = async (finalAnswers: string[]) => {
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/home'); return; }

      const engineUrl = process.env.EXPO_PUBLIC_MATCHING_ENGINE_URL;
      const engineKey = process.env.EXPO_PUBLIC_MATCHING_ENGINE_KEY ?? '';

      if (engineUrl) {
        // Llamar al matching engine para actualizar el vector
        // con las 2 nuevas respuestas (reemplaza respuestas 0 y 1)
        await fetch(`${engineUrl}/embed`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'X-Service-Key': engineKey,
          },
          body: JSON.stringify({
            user_id:         user.id,
            answers:         finalAnswers,
            is_review:       true,   // el engine reemplaza parcialmente el vector
            replace_indices: [0, 1], // reemplaza las posiciones 0 y 1 del vector
          }),
        });
      }

      // Marcar revisión como completada en Supabase
      await supabase.rpc('complete_identity_review', {
        p_user_id: user.id,
      });

    } catch (e) {
      console.error('[review] error enviando revisión:', e);
      // Si falla el engine, marcamos igualmente para no bloquear al usuario
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('complete_identity_review', { p_user_id: user.id });
      }
    } finally {
      setSaving(false);
      router.replace('/home');
    }
  };

  // ── Saltar revisión ──────────────────────────────────────
  const skip = async () => {
    // Marcar como revisada igualmente para no volver a mostrarla
    // hasta dentro de otros 90 días
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.rpc('complete_identity_review', { p_user_id: user.id });
    }
    router.replace('/home');
  };

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <Animated.View
        style={[
          styles.inner,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* CABECERA */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Revision de identidad</Text>
          <View style={styles.progressRow}>
            {REVIEW_QUESTIONS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  { backgroundColor: i <= step ? '#7F77DD' : '#2E2E2C' },
                ]}
              />
            ))}
          </View>
        </View>

        {/* CONTEXTO */}
        <View style={styles.contextCard}>
          <Text style={styles.contextText}>
            Han pasado 3 meses. Las personas cambian.{'\n'}
            Dos preguntas nuevas para que tu Pulse evolucione contigo.
          </Text>
        </View>

        {/* PREGUNTA */}
        <Text style={styles.stepLabel}>
          Pregunta {step + 1} de {REVIEW_QUESTIONS.length}
        </Text>
        <Text style={styles.question}>{REVIEW_QUESTIONS[step]}</Text>

        {/* INPUT */}
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribe aqui..."
          placeholderTextColor="#444441"
          multiline
          maxLength={300}
          autoFocus
          editable={!saving}
        />
        <Text style={styles.charCount}>{draft.length}/300</Text>

        {/* BOTÓN CONTINUAR */}
        <TouchableOpacity
          style={[styles.btn, { opacity: canContinue && !saving ? 1 : 0.4 }]}
          onPress={handleNext}
          disabled={!canContinue || saving}
        >
          <Text style={styles.btnText}>
            {saving
              ? 'Actualizando tu perfil...'
              : step < REVIEW_QUESTIONS.length - 1
                ? 'Continuar'
                : 'Actualizar mi Pulse'}
          </Text>
        </TouchableOpacity>

        {/* SALTAR */}
        {!saving && (
          <TouchableOpacity style={styles.skipBtn} onPress={skip}>
            <Text style={styles.skipText}>Saltar por ahora</Text>
          </TouchableOpacity>
        )}

      </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ────────────────────────────────────────────────────────────
// Estilos
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll:    { flexGrow: 1, justifyContent: 'center' },
  inner: {
    padding: 24,
    paddingBottom: 40,
    gap: 0,
  },

  // Cabecera
  header:      { marginBottom: 24, gap: 12 },
  eyebrow:     { fontSize: 12, color: '#7F77DD', letterSpacing: 1, fontWeight: '500' },
  progressRow: { flexDirection: 'row', gap: 8 },
  progressDot: { flex: 1, height: 3, borderRadius: 99 },

  // Contexto
  contextCard: {
    backgroundColor: '#1A1A18', borderRadius: 12,
    padding: 16, marginBottom: 28,
    borderWidth: 0.5, borderColor: '#2E2E2C',
  },
  contextText: { fontSize: 14, color: '#8F8E8A', lineHeight: 22 },

  // Pregunta
  stepLabel: { fontSize: 13, color: '#5F5E5A', marginBottom: 8 },
  question:  { fontSize: 22, fontWeight: '500', color: '#F0F0EE', marginBottom: 20, lineHeight: 30 },

  // Input
  input: {
    backgroundColor: '#1A1A18', borderRadius: 12,
    padding: 16, fontSize: 16, color: '#F0F0EE',
    minHeight: 120, textAlignVertical: 'top',
    borderWidth: 0.5, borderColor: '#2E2E2C',
  },
  charCount: { fontSize: 12, color: '#444441', textAlign: 'right', marginTop: 6, marginBottom: 24 },

  // Botones
  btn: {
    backgroundColor: '#7F77DD', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  btnText:  { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },
  skipBtn:  { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 14, color: '#5F5E5A' },
});

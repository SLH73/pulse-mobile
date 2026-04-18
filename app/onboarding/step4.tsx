import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { detectAndSaveCity } from '../../src/lib/location';

const QUESTIONS = ["¿Qué canción escuchas cuando nadie te ve?","¿Cuándo fue la última vez que reíste de verdad? ¿Qué pasó?","¿Qué es algo que te importa mucho pero que casi nadie sabe de ti?","¿Qué harías mañana si supieras que nadie te va a juzgar?","Describe el mejor momento de los últimos 6 meses en tres palabras."];

export default function Step4() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const step = 4;
  const canContinue = answer.trim().length >= 10;

  const handleFinish = async () => {
    if (!canContinue) return;

    const a0 = params.a0 ? decodeURIComponent(params.a0 as string) : '';
    const a1 = params.a1 ? decodeURIComponent(params.a1 as string) : '';
    const a2 = params.a2 ? decodeURIComponent(params.a2 as string) : '';
    const a3 = params.a3 ? decodeURIComponent(params.a3 as string) : '';

    if (!a0 || !a1 || !a2 || !a3) {
      Alert.alert('Error', 'Faltan respuestas anteriores. Por favor, empieza el cuestionario de nuevo.');
      return;
    }

    setIsSubmitting(true);
    const answers = [a0, a1, a2, a3, answer.trim()];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay sesión activa');

      const { error: upsertError } = await supabase
        .from('users')
        .upsert({ id: user.id, email: user.email!, onboarding_complete: true });

      if (upsertError) throw upsertError;

      const { data: { session } } = await supabase.auth.getSession();
      const { error: embedError } = await supabase.functions.invoke('embed-answers', {
        body: { answers },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });

      if (embedError) {
        console.error('Error generando vector:', embedError.message);
      }

      // Detectar ciudad en background — no bloquea si falla
      detectAndSaveCity(user.id).catch(() => {});

      router.replace('/home');
    } catch (e: any) {
      console.error('Error guardando onboarding:', e.message);
      setIsSubmitting(false);
      Alert.alert('Error', 'No se pudo guardar tu perfil. Comprueba tu conexión e inténtalo de nuevo.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.progressRow}>
          {QUESTIONS.map((_, i) => (<View key={i} style={[styles.progressDot, { backgroundColor: i <= step ? '#7F77DD' : '#2E2E2C' }]} />))}
        </View>
        <Text style={styles.stepLabel}>Última pregunta</Text>
        <Text style={styles.question}>{QUESTIONS[step]}</Text>
        <TextInput style={styles.input} value={answer} onChangeText={setAnswer} placeholder="Escribe aquí..." placeholderTextColor="#444441" multiline maxLength={300} autoFocus />
        <Text style={styles.charCount}>{answer.length}/300</Text>
        <TouchableOpacity style={[styles.btn, { opacity: canContinue && !isSubmitting ? 1 : 0.4 }]} onPress={handleFinish} disabled={!canContinue || isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#0D0D0D" /> : <Text style={styles.btnText}>Descubrir mi primer Pulse</Text>}
        </TouchableOpacity>
        <Text style={styles.hint}>Tus respuestas son privadas y se usan solo para encontrar tu conexión del día.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  progressDot: { flex: 1, height: 3, borderRadius: 99 },
  stepLabel: { fontSize: 13, color: '#5F5E5A', marginBottom: 8 },
  question: { fontSize: 22, fontWeight: '500', color: '#F0F0EE', marginBottom: 24, lineHeight: 30 },
  input: { backgroundColor: '#1A1A18', borderRadius: 12, padding: 16, fontSize: 16, color: '#F0F0EE', minHeight: 120, textAlignVertical: 'top', borderWidth: 0.5, borderColor: '#2E2E2C' },
  charCount: { fontSize: 12, color: '#444441', textAlign: 'right', marginTop: 6, marginBottom: 24 },
  btn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  btnText: { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },
  hint: { fontSize: 12, color: '#444441', textAlign: 'center', lineHeight: 18 },
});
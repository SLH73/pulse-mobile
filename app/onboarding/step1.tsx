import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const QUESTIONS = [
  "¿Qué canción escuchas cuando nadie te ve?",
  "¿Cuándo fue la última vez que reíste de verdad? ¿Qué pasó?",
  "¿Qué es algo que te importa mucho pero que casi nadie sabe de ti?",
  "¿Qué harías mañana si supieras que nadie te va a juzgar?",
  "Describe el mejor momento de los últimos 6 meses en tres palabras.",
];

export default function Step1() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [answer, setAnswer] = useState('');
  const step = 1;
  const canContinue = answer.trim().length >= 10;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.progressRow}>
          {QUESTIONS.map((_, i) => (
            <View key={i} style={[styles.progressDot, { backgroundColor: i <= step ? '#7F77DD' : '#2E2E2C' }]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>Pregunta {step + 1} de {QUESTIONS.length}</Text>
        <Text style={styles.question}>{QUESTIONS[step]}</Text>
        <TextInput style={styles.input} value={answer} onChangeText={setAnswer}
          placeholder="Escribe aquí..." placeholderTextColor="#444441" multiline maxLength={300} autoFocus />
        <Text style={styles.charCount}>{answer.length}/300</Text>
        <TouchableOpacity style={[styles.btn, { opacity: canContinue ? 1 : 0.4 }]}
          onPress={() => { if (!canContinue) return; router.push(`/onboarding/step2?a0=${params.a0}&a1=${encodeURIComponent(answer)}`); }}
          disabled={!canContinue}>
          <Text style={styles.btnText}>Continuar</Text>
        </TouchableOpacity>
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
  btn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },
});
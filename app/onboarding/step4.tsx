import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';

const QUESTIONS = [
  "¿Qué canción escuchas cuando nadie te ve?",
  "¿Cuándo fue la última vez que reíste de verdad? ¿Qué pasó?",
  "¿Qué es algo que te importa mucho pero que casi nadie sabe de ti?",
  "¿Qué harías mañana si supieras que nadie te va a juzgar?",
  "Describe el mejor momento de los últimos 6 meses en tres palabras.",
];

export default function Step4() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const step = 4;
  const canContinue = answer.trim().length >= 10;

  const handleFinish = async () => {
    if (!canContinue) return;
    setIsSubmitting(true);

    // Las 5 respuestas completas
    const answers = [
      decodeURIComponent(params.a0 as string),
      decodeURIComponent(params.a1 as string),
      decodeURIComponent(params.a2 as string),
      decodeURIComponent(params.a3 as string),
      answer.trim(),
    ];

    // Por ahora las guardamos en consola
    // Aquí irá la llamada a Supabase cuando conectemos el backend
    console.log('Respuestas del onboarding:', answers);

    // Simular procesamiento
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    router.replace('/home');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.progressRow}>
          {QUESTIONS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                { backgroundColor: i <= step ? '#7F77DD' : '#2E2E2C' },
              ]}
            />
          ))}
        </View>

        <Text style={styles.stepLabel}
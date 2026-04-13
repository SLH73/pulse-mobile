import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { registerForPushNotifications, savePushToken, scheduleLocalNotification } from '../../src/lib/notifications';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const setupNotifications = async () => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(token);
        await scheduleLocalNotification();
      }
    } catch (e) {
      console.log('Notificaciones no disponibles:', e);
    }
  };

  const validateAge = (): boolean => {
    const year = parseInt(birthYear);
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    return age >= 13 && age <= 19;
  };

  const handleAuth = async () => {
    if (!email || !password) return;
    setError('');

    if (isSignUp) {
      if (!birthYear || birthYear.length !== 4) {
        setError('Introduce tu año de nacimiento (ej: 2008)');
        return;
      }
      if (!validateAge()) {
        setError('Pulse es para personas de 13 a 19 años.');
        return;
      }
      if (!acceptedTerms || !acceptedPrivacy) {
        setError('Debes aceptar los terminos y la politica de privacidad.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        await setupNotifications();
        router.replace('/onboarding/step0');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await setupNotifications();
        router.replace('/home');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = isSignUp
    ? email && password && birthYear && acceptedTerms && acceptedPrivacy && !loading
    : email && password && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Pulse</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput style={styles.input} value={email} onChangeText={setEmail}
          placeholder="Email" placeholderTextColor="#444441"
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

        <TextInput style={styles.input} value={password} onChangeText={setPassword}
          placeholder="Contraseña" placeholderTextColor="#444441" secureTextEntry />

        {isSignUp && (
          <>
            <TextInput
              style={styles.input}
              value={birthYear}
              onChangeText={setBirthYear}
              placeholder="Año de nacimiento (ej: 2008)"
              placeholderTextColor="#444441"
              keyboardType="numeric"
              maxLength={4}
            />

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>
                Acepto los{' '}
                <Text style={styles.link} onPress={() => router.push('/legal/terms')}>términos y condiciones</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
            >
              <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
                {acceptedPrivacy && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>
                Acepto la{' '}
                <Text style={styles.link} onPress={() => router.push('/legal/privacy')}>política de privacidad</Text>
              </Text>
            </TouchableOpacity>

            <View style={styles.gdprBox}>
              <Text style={styles.gdprText}>
                Pulse cumple con el RGPD y la LOPD. Tus datos nunca se venden
                ni se comparten con terceros. Si tienes menos de 14 años,
                necesitas el consentimiento de tus padres.
              </Text>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.btn, { opacity: canSubmit ? 1 : 0.4 }]}
          onPress={handleAuth}
          disabled={!canSubmit}
        >
          {loading
            ? <ActivityIndicator color="#0D0D0D" />
            : <Text style={styles.btnText}>{isSignUp ? 'Crear cuenta' : 'Entrar'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(''); }}>
          <Text style={styles.switchText}>
            {isSignUp
              ? 'Ya tienes cuenta? Inicia sesion'
              : 'No tienes cuenta? Registrate'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 40, fontWeight: '500', color: '#F0F0EE', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#5F5E5A', marginBottom: 32, textAlign: 'center' },
  error: { fontSize: 13, color: '#E24B4A', marginBottom: 16, textAlign: 'center' },
  input: {
    backgroundColor: '#1A1A18', borderRadius: 12, padding: 16,
    fontSize: 16, color: '#F0F0EE', borderWidth: 0.5,
    borderColor: '#2E2E2C', marginBottom: 12,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 1, borderColor: '#5F5E5A',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#7F77DD', borderColor: '#7F77DD' },
  checkmark: { fontSize: 14, color: '#0D0D0D', fontWeight: '500' },
  checkLabel: { flex: 1, fontSize: 14, color: '#F0F0EE' },
  link: { color: '#7F77DD' },
  gdprBox: {
    backgroundColor: '#1A1A18', borderRadius: 12, padding: 16,
    marginBottom: 20, borderWidth: 0.5, borderColor: '#2E2E2C',
  },
  gdprText: { fontSize: 12, color: '#5F5E5A', lineHeight: 18 },
  btn: {
    backgroundColor: '#7F77DD', borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 16, marginTop: 8,
  },
  btnText: { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },
  switchText: { fontSize: 14, color: '#7F77DD', textAlign: 'center' },
});
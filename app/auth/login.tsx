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
import { detectAndSaveCity } from '../../src/lib/location';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [parentEmail, setParentEmail] = useState('');
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

  // ✅ FIX BUG-003: Calcula edad real con fecha exacta
  const getAge = (): number => {
    const year = parseInt(birthYear);
    const today = new Date();
    const birthDate = new Date(year, 0, 1); // 1 enero del año de nacimiento
    let age = today.getFullYear() - birthDate.getFullYear();
    return age;
  };

  // ✅ FIX BUG-003: Bloquea correctamente < 13 y > 19
  const validateAge = (): { valid: boolean; reason?: string } => {
    const age = getAge();
    if (age < 13) return { valid: false, reason: 'menor13' };
    if (age > 19) return { valid: false, reason: 'mayor19' };
    return { valid: true };
  };

  // ✅ FIX BUG-003: Consentimiento parental para 13-15 (DSA Art. 28 — <16), NO para <13
  const needsParentalConsent = (): boolean => {
    if (birthYear.length !== 4) return false;
    const age = getAge();
    return age >= 13 && age <= 15;
  };

  // ✅ FIX BUG-001: Crea la fila en users tras el signup
  const createUserProfile = async (userId: string) => {
    const birthDate = birthYear.length === 4
      ? `${birthYear}-01-01`
      : null;

    const { error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email,
        onboarding_complete: false,
        depth_score: 0,
        is_paused: false,
        is_deep: false,
        birth_date: birthDate, // ✅ FIX BUG-004: Guarda birth_date
        parental_email: needsParentalConsent() && parentEmail ? parentEmail : null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id', ignoreDuplicates: false });

    if (error) console.error('Error creando perfil de usuario:', error);
  };

  const translateAuthError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials') || m.includes('invalid credentials') || m.includes('user not found'))
      return 'Email o contraseña incorrectos.';
    if (m.includes('email not confirmed'))
      return 'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.';
    if (m.includes('user already registered') || m.includes('already registered'))
      return 'Este email ya está registrado. Inicia sesión.';
    if (m.includes('password should be at least') || m.includes('password must be'))
      return 'La contraseña debe tener al menos 6 caracteres.';
    if (m.includes('unable to validate email') || m.includes('invalid email'))
      return 'El formato del email no es válido.';
    if (m.includes('signup is disabled'))
      return 'El registro está desactivado temporalmente.';
    if (m.includes('rate limit') || m.includes('too many requests'))
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    if (m.includes('network') || m.includes('fetch'))
      return 'Error de conexión. Comprueba tu internet.';
    return 'Algo salió mal. Inténtalo de nuevo.';
  };

  const handleAuth = async () => {
    if (!email || !password) return;
    setError('');

    if (isSignUp) {
      if (!birthYear || birthYear.length !== 4) {
        setError('Introduce tu año de nacimiento (ej: 2008)');
        return;
      }

      // ✅ FIX BUG-003: Validación con mensaje específico por rango
      const ageCheck = validateAge();
      if (!ageCheck.valid) {
        if (ageCheck.reason === 'menor13') {
          setError('Lo sentimos, Pulse es solo para personas de 13 a 19 años.');
        } else {
          setError('Pulse es para personas de 13 a 19 años.');
        }
        return;
      }

      if (!acceptedTerms || !acceptedPrivacy) {
        setError('Debes aceptar los términos y la política de privacidad.');
        return;
      }
      if (needsParentalConsent() && !parentEmail) {
        setError('Al tener menos de 16 años necesitas el email de un padre o tutor.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // ✅ FIX BUG-001: Crear fila en users inmediatamente tras signup
        if (data.user) {
          await createUserProfile(data.user.id);
        }

        await setupNotifications();
        router.replace('/onboarding/step0');
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await setupNotifications();
        detectAndSaveCity(signInData.user!.id).catch(() => {});

        // ✅ FIX BUG-005: Verificar onboarding_complete antes de navegar
        const { data: userData } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', signInData.user!.id)
          .single();

        if (!userData?.onboarding_complete) {
          router.replace('/onboarding/step0');
        } else {
          router.replace('/home');
        }
      }
    } catch (e: any) {
      setError(translateAuthError(e.message));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = isSignUp
    ? email && password && birthYear && acceptedTerms && acceptedPrivacy && !loading
    : email && password && !loading;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Pulse</Text>
        <Text style={styles.subtitle}>{isSignUp ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}</Text>

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

            {/* ✅ FIX BUG-003: Solo muestra consentimiento para 13-15 (DSA <16), nunca para <13 */}
            {needsParentalConsent() && (
              <View style={styles.parentalBox}>
                <Text style={styles.parentalTitle}>Consentimiento parental requerido</Text>
                <Text style={styles.parentalText}>
                  Al tener menos de 16 años, necesitamos el email de tu padre, madre o tutor legal.
                </Text>
                <TextInput
                  style={styles.input}
                  value={parentEmail}
                  onChangeText={setParentEmail}
                  placeholder="Email del padre/madre/tutor"
                  placeholderTextColor="#444441"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            )}

            <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedTerms(!acceptedTerms)}>
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>
                Acepto los{' '}
                <Text style={styles.link} onPress={() => router.push('/legal/terms')}>términos y condiciones</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}>
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
                Pulse cumple con el RGPD y la LOPD. Tus datos nunca se venden ni se comparten con terceros.
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
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </Text>
        </TouchableOpacity>

        {/* ✅ FIX BUG-020: Links legales visibles en login sin sesión */}
        <View style={styles.legalRow}>
          <Text style={styles.legalLink} onPress={() => router.push('/legal/privacy')}>
            Política de privacidad
          </Text>
          <Text style={styles.legalSep}> · </Text>
          <Text style={styles.legalLink} onPress={() => router.push('/legal/terms')}>
            Términos y condiciones
          </Text>
        </View>
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
  parentalBox: {
    backgroundColor: '#1D1010', borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 0.5, borderColor: '#E24B4A',
  },
  parentalTitle: { fontSize: 14, fontWeight: '500', color: '#E24B4A', marginBottom: 8 },
  parentalText: { fontSize: 12, color: '#888780', lineHeight: 18, marginBottom: 12 },
  btn: {
    backgroundColor: '#7F77DD', borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 16, marginTop: 8,
  },
  btnText: { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },
  switchText: { fontSize: 14, color: '#7F77DD', textAlign: 'center', marginBottom: 16 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  legalLink: { fontSize: 12, color: '#5F5E5A' },
  legalSep: { fontSize: 12, color: '#5F5E5A' },
});

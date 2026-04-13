import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { registerForPushNotifications, savePushToken, scheduleLocalNotification } from '../../src/lib/notifications';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleAuth = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');

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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <Text style={styles.title}>Pulse</Text>
        <Text style={styles.subtitle}>{isSignUp ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput style={styles.input} value={email} onChangeText={setEmail}
          placeholder="Email" placeholderTextColor="#444441"
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

        <TextInput style={styles.input} value={password} onChangeText={setPassword}
          placeholder="Contrasena" placeholderTextColor="#444441" secureTextEntry />

        <TouchableOpacity style={[styles.btn, { opacity: email && password && !loading ? 1 : 0.4 }]}
          onPress={handleAuth} disabled={!email || !password || loading}>
          {loading ? <ActivityIndicator color="#0D0D0D" /> : <Text style={styles.btnText}>{isSignUp ? 'Crear cuenta' : 'Entrar'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={styles.switchText}>
            {isSignUp ? 'Ya tienes cuenta? Inicia sesion' : 'No tienes cuenta? Registrate'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 40, fontWeight: '500', color: '#F0F0EE', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#5F5E5A', marginBottom: 32, textAlign: 'center' },
  error: { fontSize: 13, color: '#E24B4A', marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: '#1A1A18', borderRadius: 12, padding: 16, fontSize: 16, color: '#F0F0EE', borderWidth: 0.5, borderColor: '#2E2E2C', marginBottom: 12 },
  btn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16, marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },
  switchText: { fontSize: 14, color: '#7F77DD', textAlign: 'center' },
});
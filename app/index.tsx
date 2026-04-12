import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Por ahora redirige al onboarding siempre
    // Cuando añadamos auth, aquí irá la lógica de sesión
    const timer = setTimeout(() => {
      router.replace('/onboarding/step0');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#7F77DD" />
    </View>
  );
}
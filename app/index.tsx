import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../src/lib/supabase';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace('/home');
        } else {
          router.replace('/auth/login');
        }
      } catch (e) {
        router.replace('/auth/login');
      } finally {
        setChecking(false);
      }
    };

    // Pequeño delay para que Supabase inicialice
    const timer = setTimeout(checkSession, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{
      flex: 1,
      backgroundColor: '#0D0D0D',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <ActivityIndicator color="#7F77DD" size="large" />
    </View>
  );
}
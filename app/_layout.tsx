import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const inAuth = segments[0] === 'auth';
        const inLegal = segments[0] === 'legal';

        if (!session && !inAuth && !inLegal) {
          router.replace('/auth/login');
        } else if (session && inAuth) {
          router.replace('/home');
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGuard>
  );
}
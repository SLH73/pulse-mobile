import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { registerPushToken } from '../src/lib/notifications';
import { initRevenueCat } from '../src/lib/revenuecat';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const inAuth  = segments[0] === 'auth';
        const inLegal = segments[0] === 'legal';

        if (!session && !inAuth && !inLegal) {
          router.replace('/auth/login');
        } else if (session && inAuth) {
          router.replace('/home');
        }

        // Al iniciar sesión → registrar token push e inicializar RevenueCat
        if (session?.user) {
          const userId = session.user.id;
          registerPushToken(userId);
          initRevenueCat(userId);
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

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
        const inAuth       = segments[0] === 'auth';
        const inLegal      = segments[0] === 'legal';
        const inOnboarding = segments[0] === 'onboarding';

        if (!session && !inAuth && !inLegal) {
          router.replace('/auth/login');
          return;
        }

        if (session && inAuth) {
          // ✅ FIX BUG-005: Verificar onboarding_complete antes de navegar
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('onboarding_complete')
              .eq('id', session.user.id)
              .single();

            if (!userData?.onboarding_complete) {
              router.replace('/onboarding/step0');
            } else {
              router.replace('/home');
            }
          } catch (e) {
            console.error('Error verificando onboarding:', e);
            router.replace('/home');
          }
        }

        // Registrar token push e inicializar RevenueCat al iniciar sesion
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

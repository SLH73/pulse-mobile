import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: CORS_HEADERS,
    });
  }

  // Verificar JWT del usuario (el menor que acaba de registrarse)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: CORS_HEADERS,
    });
  }

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  const { data: { user }, error: authError } = await serviceClient.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: CORS_HEADERS,
    });
  }

  // Leer parental_email del usuario
  const { data: userData, error: dbError } = await serviceClient
    .from('users')
    .select('parental_email, parental_consent_verified')
    .eq('id', user.id)
    .single();

  if (dbError || !userData?.parental_email) {
    return new Response(JSON.stringify({ error: 'No parental email configured' }), {
      status: 404, headers: CORS_HEADERS,
    });
  }

  // Si ya está verificado, no reenviar
  if (userData.parental_consent_verified) {
    return new Response(JSON.stringify({ alreadyVerified: true }), {
      status: 200, headers: CORS_HEADERS,
    });
  }

  // Enviar OTP al email parental via Supabase Auth
  // El padre recibirá un email con código de 6 dígitos para acceder al panel parental
  const { error: otpError } = await anonClient.auth.signInWithOtp({
    email: userData.parental_email,
    options: { shouldCreateUser: true },
  });

  if (otpError) {
    console.error('[send-parental-invite] Error enviando OTP:', otpError.message);
    return new Response(JSON.stringify({ error: 'Error enviando email' }), {
      status: 500, headers: CORS_HEADERS,
    });
  }

  console.log('[send-parental-invite] OTP enviado a:', userData.parental_email, 'para user:', user.id);

  return new Response(JSON.stringify({ sent: true }), {
    status: 200, headers: CORS_HEADERS,
  });
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { user_id, match_user_id } = await req.json();

    if (!user_id || !match_user_id) {
      return new Response(JSON.stringify({ error: 'user_id y match_user_id requeridos' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error } = await supabase
      .from('users')
      .select('expo_push_token')
      .eq('id', user_id)
      .single();

    if (error || !userData?.expo_push_token) {
      return new Response(JSON.stringify({ error: 'token_not_found' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = userData.expo_push_token;

    if (!token.startsWith('ExponentPushToken[')) {
      return new Response(JSON.stringify({ error: 'invalid_token_format' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const message = {
      to:    token,
      sound: 'default',
      title: 'Tu Pulse de hoy',
      body:  'Alguien te está esperando. Tienes 72h para conectar.',
      data:  { type: 'new_match', match_user_id },
      channelId: 'pulse',
    };

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const pushResult = await pushResponse.json();
    const ticket = pushResult?.data;

    if (ticket?.status === 'error') {
      console.error('[notify-match] Error de Expo:', ticket.message);
    }

    return new Response(JSON.stringify({ success: true, ticket }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[notify-match] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
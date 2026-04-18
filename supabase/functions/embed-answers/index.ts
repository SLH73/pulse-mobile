import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MATCHING_ENGINE_URL = Deno.env.get('MATCHING_ENGINE_URL') ?? '';
const MATCHING_ENGINE_KEY = Deno.env.get('MATCHING_ENGINE_SERVICE_KEY') ?? '';

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

  // Verificar que el caller está autenticado con JWT de Supabase
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: CORS_HEADERS,
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: CORS_HEADERS,
    });
  }

  let answers: string[];
  try {
    const body = await req.json();
    answers = body.answers;
    if (
      !Array.isArray(answers) ||
      answers.length < 2 ||
      answers.length > 20 ||
      answers.some((a) => typeof a !== 'string' || a.trim().length < 10)
    ) {
      throw new Error('invalid');
    }
  } catch {
    return new Response(JSON.stringify({ error: 'answers debe ser un array de 2-20 respuestas no vacías' }), {
      status: 400, headers: CORS_HEADERS,
    });
  }

  if (!MATCHING_ENGINE_URL || !MATCHING_ENGINE_KEY) {
    console.error('[embed-answers] MATCHING_ENGINE_URL o MATCHING_ENGINE_SERVICE_KEY no configurados');
    return new Response(JSON.stringify({ error: 'Engine no configurado' }), {
      status: 503, headers: CORS_HEADERS,
    });
  }

  const engineRes = await fetch(`${MATCHING_ENGINE_URL}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-service-key': MATCHING_ENGINE_KEY,
    },
    body: JSON.stringify({ user_id: user.id, answers }),
  });

  if (!engineRes.ok) {
    const text = await engineRes.text();
    console.error('[embed-answers] error del engine', engineRes.status, text.slice(0, 200));
    return new Response(JSON.stringify({ error: 'Error del engine' }), {
      status: 502, headers: CORS_HEADERS,
    });
  }

  const result = await engineRes.json();
  return new Response(JSON.stringify({ success: true, dim: result.dim }), {
    status: 200, headers: CORS_HEADERS,
  });
});

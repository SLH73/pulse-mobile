import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

const SYSTEM_PROMPT = `Eres un sistema de moderacion de contenido para una app de amistad entre adolescentes de 13-19 anos.

Analiza el mensaje que te envian y responde UNICAMENTE con un objeto JSON valido, sin texto adicional, sin backticks, sin explicaciones.

El JSON debe tener exactamente esta estructura:
{
  "toxicity": 0.0,
  "threat": 0.0,
  "sexually_explicit": 0.0
}

Cada valor es un numero entre 0.0 (completamente seguro) y 1.0 (extremadamente inapropiado).

Definiciones:
- toxicity: insultos, odio, acoso, lenguaje degradante
- threat: amenazas directas o indirectas de dano fisico o emocional
- sexually_explicit: contenido sexual explicito o sugestivo inapropiado para menores

Se estricto. Esta app es para menores de edad.`;

const FAIL_CLOSED = {
  approved: false,
  flag: true,
  scores: { toxicity: 0, threat: 0, sexually_explicit: 0 },
  reason: 'error_moderacion',
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

  // Verificar JWT del usuario
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

  // Validar body
  let text: string;
  try {
    const body = await req.json();
    text = body.text;
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > 2000) {
      throw new Error('invalid');
    }
  } catch {
    return new Response(JSON.stringify({ error: 'text requerido (max 2000 chars)' }), {
      status: 400, headers: CORS_HEADERS,
    });
  }

  // Sin API key → fail-closed en producción, fail-open solo en dev explícito
  if (!ANTHROPIC_KEY) {
    const isDev = Deno.env.get('ENVIRONMENT') === 'development';
    const result = isDev
      ? { approved: true, flag: false, scores: { toxicity: 0, threat: 0, sexually_explicit: 0 } }
      : FAIL_CLOSED;
    return new Response(JSON.stringify(result), { status: 200, headers: CORS_HEADERS });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: text }],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('[moderate] Anthropic HTTP', response.status);
      return new Response(JSON.stringify(FAIL_CLOSED), { status: 200, headers: CORS_HEADERS });
    }

    const data = await response.json();
    const raw  = data?.content?.[0]?.text ?? '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    const scores = JSON.parse(clean);

    const toxicity         = Number(scores.toxicity         ?? 0);
    const threat           = Number(scores.threat           ?? 0);
    const sexually_explicit = Number(scores.sexually_explicit ?? 0);
    const maxScore = Math.max(toxicity, threat, sexually_explicit);

    const wordCount = text.trim().split(/\s+/).length;
    const isShort   = text.trim().length <= 20 || wordCount <= 4;
    const blockAt   = isShort ? 0.6 : 0.8;
    const flagAt    = isShort ? 0.75 : 0.9;

    let reason: string | undefined;
    if (maxScore > blockAt) {
      if (sexually_explicit === maxScore) reason = 'contenido sexual';
      else if (threat === maxScore)       reason = 'amenaza';
      else                                reason = 'lenguaje toxico';
    }

    return new Response(JSON.stringify({
      approved: maxScore <= blockAt,
      flag:     maxScore > flagAt,
      scores:   { toxicity, threat, sexually_explicit },
      reason,
    }), { status: 200, headers: CORS_HEADERS });

  } catch (err) {
    console.error('[moderate] Error:', err);
    return new Response(JSON.stringify(FAIL_CLOSED), { status: 200, headers: CORS_HEADERS });
  }
});

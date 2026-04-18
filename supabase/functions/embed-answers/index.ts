import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MATCHING_ENGINE_URL = Deno.env.get('MATCHING_ENGINE_URL') ?? '';
const MATCHING_ENGINE_KEY = Deno.env.get('MATCHING_ENGINE_SERVICE_KEY') ?? '';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify caller is authenticated
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
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
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let answers: string[];
  try {
    const body = await req.json();
    answers = body.answers;
    if (!Array.isArray(answers) || answers.length !== 5 || answers.some((a) => typeof a !== 'string' || a.trim().length < 10)) {
      throw new Error('invalid');
    }
  } catch {
    return new Response(JSON.stringify({ error: 'answers must be an array of 5 non-empty strings' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!MATCHING_ENGINE_URL || !MATCHING_ENGINE_KEY) {
    console.error('[embed-answers] MATCHING_ENGINE_URL or MATCHING_ENGINE_SERVICE_KEY not configured');
    return new Response(JSON.stringify({ error: 'Engine not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
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
    console.error('[embed-answers] engine error', engineRes.status, text.slice(0, 200));
    return new Response(JSON.stringify({ error: 'Engine error' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await engineRes.json();
  return new Response(JSON.stringify({ success: true, dim: result.dim }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});

// ────────────────────────────────────────────────────────────
// src/lib/moderation.ts
// Moderación proactiva de mensajes con Claude API
// ────────────────────────────────────────────────────────────

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY ?? '';

export interface ModerationResult {
  approved: boolean;         // true = mensaje limpio, false = bloqueado
  flag: boolean;             // true = marcar cuenta para revisión manual
  scores: {
    toxicity: number;        // 0.0 – 1.0
    threat: number;
    sexually_explicit: number;
  };
  reason?: string;           // categoría que disparó el bloqueo
}

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

export async function moderateMessage(text: string): Promise<ModerationResult> {
  // Si no hay key configurada, dejar pasar (modo dev sin moderacion)
  if (!ANTHROPIC_KEY) {
    console.warn('[moderation] EXPO_PUBLIC_ANTHROPIC_KEY no configurada — moderacion desactivada');
    return {
      approved: true,
      flag: false,
      scores: { toxicity: 0, threat: 0, sexually_explicit: 0 },
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Haiku: rapido y barato para moderacion
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      console.error('[moderation] Error de API:', response.status);
      // En caso de error de red, dejar pasar para no bloquear la UX
      return {
        approved: true,
        flag: false,
        scores: { toxicity: 0, threat: 0, sexually_explicit: 0 },
      };
    }

    const data = await response.json();
    const raw = data?.content?.[0]?.text ?? '{}';

    // Limpiar posibles backticks residuales
    const clean = raw.replace(/```json|```/g, '').trim();
    const scores = JSON.parse(clean);

    const toxicity        = Number(scores.toxicity        ?? 0);
    const threat          = Number(scores.threat          ?? 0);
    const sexually_explicit = Number(scores.sexually_explicit ?? 0);

    const maxScore = Math.max(toxicity, threat, sexually_explicit);

    // FIX BUG-009: umbral más bajo para mensajes cortos (<= 4 palabras o <= 20 chars)
    // "te odio" pasa con 0.8 pero debe bloquearse con umbral 0.6
    const wordCount = text.trim().split(/\s+/).length;
    const isShort   = text.trim().length <= 20 || wordCount <= 4;
    const blockAt   = isShort ? 0.6 : 0.8;
    const flagAt    = isShort ? 0.75 : 0.9;

    // Determinar categoría que disparó el bloqueo
    let reason: string | undefined;
    if (maxScore > blockAt) {
      if (sexually_explicit === maxScore) reason = 'contenido sexual';
      else if (threat === maxScore)       reason = 'amenaza';
      else                                reason = 'lenguaje toxico';
    }

    return {
      approved: maxScore <= blockAt,
      flag:     maxScore > flagAt,
      scores:   { toxicity, threat, sexually_explicit },
      reason,
    };

  } catch (error) {
    console.error('[moderation] Error inesperado:', error);
    // En caso de error de parseo u otro, dejar pasar
    return {
      approved: true,
      flag: false,
      scores: { toxicity: 0, threat: 0, sexually_explicit: 0 },
    };
  }
}

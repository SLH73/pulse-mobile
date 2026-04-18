import { supabase } from './supabase';

export interface ModerationResult {
  approved: boolean;
  flag: boolean;
  scores: {
    toxicity: number;
    threat: number;
    sexually_explicit: number;
  };
  reason?: string;
}

const FAIL_CLOSED: ModerationResult = {
  approved: false,
  flag: true,
  scores: { toxicity: 0, threat: 0, sexually_explicit: 0 },
  reason: 'error_moderacion',
};

export async function moderateMessage(text: string): Promise<ModerationResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke('moderate', {
      body: { text },
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    });

    if (error) {
      console.error('[moderation] Error de Edge Function:', error.message);
      return FAIL_CLOSED;
    }

    return data as ModerationResult;
  } catch (err) {
    console.error('[moderation] Error inesperado:', err);
    return FAIL_CLOSED;
  }
}

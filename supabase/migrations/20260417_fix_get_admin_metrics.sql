-- FIX BUG-015: saved_contacts usa saved_at, no created_at
-- La función get_admin_metrics fallaba con "column created_at does not exist"
-- DROP necesario porque CREATE OR REPLACE no puede cambiar el return type

DROP FUNCTION IF EXISTS public.get_admin_metrics();

CREATE OR REPLACE FUNCTION public.get_admin_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dau            integer;
  v_matches_today  integer;
  v_pct_chat_open  integer;
  v_pct_saved      integer;
  v_new_users_week integer;
  v_waitlist_count integer;
  v_flags_pending  integer;
BEGIN
  -- Usuarios activos hoy (han enviado al menos 1 mensaje hoy)
  SELECT COUNT(DISTINCT sender_id)
    INTO v_dau
    FROM messages
   WHERE created_at >= CURRENT_DATE;

  -- Matches generados hoy
  SELECT COUNT(*)
    INTO v_matches_today
    FROM daily_matches
   WHERE created_at >= CURRENT_DATE;

  -- % de matches que han abierto chat (tienen al menos 1 mensaje)
  SELECT CASE WHEN v_matches_today = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(DISTINCT match_id) / NULLIF(v_matches_today, 0)
    )
    END
    INTO v_pct_chat_open
    FROM messages
   WHERE created_at >= CURRENT_DATE;

  -- % de chats que han guardado contacto (saved_at, no created_at)
  SELECT CASE WHEN v_matches_today = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(DISTINCT match_id) / NULLIF(v_matches_today, 0)
    )
    END
    INTO v_pct_saved
    FROM saved_contacts
   WHERE saved_at >= CURRENT_DATE;  -- FIX: saved_at en lugar de created_at

  -- Nuevos usuarios esta semana
  SELECT COUNT(*)
    INTO v_new_users_week
    FROM users
   WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE);

  -- Lista de espera
  SELECT COUNT(*)
    INTO v_waitlist_count
    FROM waitlist;

  -- Flags de moderación pendientes de revisión
  SELECT COUNT(*)
    INTO v_flags_pending
    FROM moderation_flags
   WHERE reviewed = false;

  RETURN json_build_object(
    'dau',            v_dau,
    'matches_today',  v_matches_today,
    'pct_chat_open',  COALESCE(v_pct_chat_open, 0),
    'pct_saved',      COALESCE(v_pct_saved, 0),
    'new_users_week', v_new_users_week,
    'waitlist_count', v_waitlist_count,
    'flags_pending',  v_flags_pending,
    'generated_at',   NOW()
  );
END;
$$;

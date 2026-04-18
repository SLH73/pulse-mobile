-- ── GDPR: Purga automática de datos ────────────────────────────────────────
-- Art. 17 GDPR: borrado físico 30 días tras deletion_requested_at
-- Mensajes efímeros: borrado físico 7 días tras expiración del match
-- Ejecutado diariamente a las 03:00 UTC via pg_cron

-- 1. Habilitar extensión pg_cron (si no está activa)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Función de purga
CREATE OR REPLACE FUNCTION purge_deleted_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_ids uuid[];
BEGIN
  -- Recoger IDs de usuarios que pidieron eliminación hace 30+ días
  SELECT array_agg(id)
  INTO deleted_ids
  FROM users
  WHERE deletion_requested_at < NOW() - INTERVAL '30 days';

  IF deleted_ids IS NULL OR array_length(deleted_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Borrar en orden para respetar foreign keys
  DELETE FROM moderation_flags  WHERE reporter_id    = ANY(deleted_ids);
  DELETE FROM saved_contacts    WHERE user_id         = ANY(deleted_ids)
                                   OR contact_id      = ANY(deleted_ids);
  DELETE FROM messages          WHERE sender_id       = ANY(deleted_ids);
  DELETE FROM daily_matches     WHERE user_a           = ANY(deleted_ids)
                                   OR user_b           = ANY(deleted_ids);
  DELETE FROM identity_vectors  WHERE user_id         = ANY(deleted_ids);
  DELETE FROM weekly_capsules   WHERE user_id         = ANY(deleted_ids);
  DELETE FROM invites           WHERE inviter_id      = ANY(deleted_ids);
  DELETE FROM users             WHERE id              = ANY(deleted_ids);

  RAISE LOG 'purge_deleted_users: eliminados % usuarios', array_length(deleted_ids, 1);
END;
$$;

-- 3. Función de purga de mensajes efímeros expirados (TTL producto)
CREATE OR REPLACE FUNCTION purge_expired_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM messages
  WHERE match_id IN (
    SELECT id FROM daily_matches
    WHERE expires_at < NOW() - INTERVAL '7 days'
  );
END;
$$;

-- 4. Programar purgas diarias a las 03:00 UTC
SELECT cron.schedule(
  'gdpr-purge-deleted-users',
  '0 3 * * *',
  'SELECT purge_deleted_users()'
);

SELECT cron.schedule(
  'purge-expired-messages',
  '30 3 * * *',
  'SELECT purge_expired_messages()'
);

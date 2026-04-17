-- Tabla weekly_capsules: resumen semanal de actividad por usuario

CREATE TABLE IF NOT EXISTS public.weekly_capsules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start      date NOT NULL,
  conversations   integer NOT NULL DEFAULT 0,
  saved_contacts  integer NOT NULL DEFAULT 0,
  depth_delta     integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

-- RLS: solo el propio usuario puede ver sus cápsulas
ALTER TABLE public.weekly_capsules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capsules_own" ON public.weekly_capsules
  FOR ALL USING (auth.uid() = user_id);

-- Índice para queries por usuario ordenadas por semana
CREATE INDEX IF NOT EXISTS weekly_capsules_user_week
  ON public.weekly_capsules (user_id, week_start DESC);

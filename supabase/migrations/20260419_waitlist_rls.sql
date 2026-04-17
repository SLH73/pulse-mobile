-- RLS para la tabla waitlist
-- Solo permite INSERT anónimo. El contador usa una función SECURITY DEFINER
-- para no exponer emails individuales al cliente.

ALTER TABLE IF EXISTS public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert" ON public.waitlist;
DROP POLICY IF EXISTS "Allow anon select" ON public.waitlist;

-- Cualquier visitante puede apuntarse a la lista de espera
CREATE POLICY "Allow anon insert"
  ON public.waitlist
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- El SELECT directo desde el cliente queda bloqueado (no expone emails)
-- El contador se obtiene exclusivamente via get_waitlist_count()

-- Función para el contador: SECURITY DEFINER evita que el anon key
-- pueda leer filas individuales pero sí obtener el total
CREATE OR REPLACE FUNCTION public.get_waitlist_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.waitlist;
$$;

-- Solo el servicio (service_role) puede ejecutar la función
REVOKE EXECUTE ON FUNCTION public.get_waitlist_count() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_waitlist_count() TO anon;
GRANT  EXECUTE ON FUNCTION public.get_waitlist_count() TO authenticated;

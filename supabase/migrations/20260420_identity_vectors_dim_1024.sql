-- Migración: ampliar identity_vectors de 128 → 1024 dimensiones para Voyage AI
-- IMPORTANTE: esto borra los vectores existentes porque no se puede hacer CAST
-- de vector(128) a vector(1024). Los usuarios deberán re-generar su vector
-- completando el onboarding o la revisión de identidad.

-- Borrar vectores existentes (son pseudoaleatorios sin valor semántico real)
TRUNCATE TABLE identity_vectors;

-- Cambiar la dimensión de la columna
ALTER TABLE identity_vectors
  ALTER COLUMN vector TYPE vector(1024);

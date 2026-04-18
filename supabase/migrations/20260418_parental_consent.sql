-- Columna para marcar consentimiento parental verificado (DSA Art. 28)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS parental_consent_verified boolean NOT NULL DEFAULT false;

-- Columna parental_email si no existe aún
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS parental_email text;

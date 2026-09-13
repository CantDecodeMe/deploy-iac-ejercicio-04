-- =====================================================================
-- Ejercicio 04 -- libros-ms: columna `formato` (migracion aditiva)
-- =====================================================================
-- El contrato de /books pide un filtro `format` que no existia en el
-- esquema del monolito (Ejercicio 02). Se agrega una columna nueva, sin
-- tocar ninguna columna existente:
--
--   - NOT NULL con DEFAULT: Postgres backfillea las filas existentes con
--     el default en la misma sentencia, sin dejar NULLs a medio migrar.
--   - Todo el catalogo actual son libros fisicos, asi que 'Fisico' es un
--     default correcto para las filas ya sembradas.
--   - Es idempotente (IF NOT EXISTS): se puede correr las veces que haga
--     falta sin fallar si ya se aplico.
--
-- Verificado antes de aplicarla que no rompe nada existente:
--   - ej02 (monolito) solo hace INSERT/UPDATE con listas de columnas
--     explicitas sobre `libros`, nunca posicionales -- una columna nueva
--     no desalinea ningun VALUES(...).
--   - El unico `SELECT * FROM libros` del monolito alimenta una plantilla
--     EJS que lee campos por nombre, no por indice.
--   - ej03 (SOAP) nunca hace SELECT * ni escribe en `libros`; solo lee
--     `titulo` e `isbn` a traves de una vista con columnas explicitas.
--   - No hay ningun validador de esquema (Joi/Zod/Ajv) en el monolito que
--     pueda rechazar un campo extra.
--
-- Se invoca con:
--   psql -f 02_formato_migracion.sql
-- =====================================================================

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'libros' AND column_name = 'formato'
  ) THEN
    ALTER TABLE public.libros ADD COLUMN formato text NOT NULL DEFAULT 'Fisico';
  END IF;
END
$$;

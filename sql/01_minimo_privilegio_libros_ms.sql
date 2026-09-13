-- =====================================================================
-- Ejercicio 04 -- libros-ms: rol de minimo privilegio
-- =====================================================================
-- Mismo criterio que sql/03_minimo_privilegio.sql de ej03: nada de
-- superusuario desde la aplicacion, y este archivo documenta -- de forma
-- ejecutable -- exactamente que puede leer el servicio.
--
-- Se invoca con:
--   psql -v libros_password="'...'" -f 01_minimo_privilegio_libros_ms.sql
-- =====================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------
-- El rol. NOSUPERUSER, NOCREATEDB, NOCREATEROLE, sin herencia de nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'libros_ms_svc') THEN
    CREATE ROLE libros_ms_svc LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

ALTER ROLE libros_ms_svc WITH PASSWORD :libros_password;

COMMENT ON ROLE libros_ms_svc IS
  'Cuenta de servicio de libros-ms (Ejercicio 04). Solo lectura sobre el catalogo del monolito.';


BEGIN;

-- ---------------------------------------------------------------------
-- Conexion y navegacion de esquemas
-- ---------------------------------------------------------------------
GRANT CONNECT ON DATABASE libreria TO libros_ms_svc;
GRANT USAGE   ON SCHEMA public     TO libros_ms_svc;

-- No puede crear objetos en el esquema.
REVOKE CREATE ON SCHEMA public FROM libros_ms_svc;


-- ---------------------------------------------------------------------
-- Catalogo: SOLO LECTURA sobre lo que expone el contrato de /books
-- ---------------------------------------------------------------------
--  libros       -> titulo, isbn, precio, stock, portada, formato, fecha
--  categorias   -> genero
--  autores + libro_autor -> autores del libro
--  editoriales  -> editorial
--  conceptos    -> glosario asociado al libro
--
-- Todo lo demas queda fuera de alcance a proposito:
--  usuarios, pedidos, detalle_pedido, sesiones.
-- ---------------------------------------------------------------------
GRANT SELECT ON
  public.libros,
  public.categorias,
  public.autores,
  public.libro_autor,
  public.editoriales,
  public.conceptos
  TO libros_ms_svc;

-- Explicito por si acaso: ni un INSERT/UPDATE/DELETE sobre el catalogo.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.libros,
  public.categorias,
  public.autores,
  public.libro_autor,
  public.editoriales,
  public.conceptos
  FROM libros_ms_svc;

-- Y ni SELECT sobre lo sensible. (Por defecto ya no lo tiene; el REVOKE
-- deja constancia de la intencion y protege si alguien afloja permisos.)
REVOKE ALL ON public.usuarios       FROM libros_ms_svc;
REVOKE ALL ON public.pedidos        FROM libros_ms_svc;
REVOKE ALL ON public.detalle_pedido FROM libros_ms_svc;
REVOKE ALL ON public.sesiones       FROM libros_ms_svc;

COMMIT;

#!/usr/bin/env bash
# =====================================================================
# Ejercicio 04 -- Aplica la migracion y el rol de libros-ms contra libreria-db-1
# =====================================================================
# Idempotente: se puede correr las veces que haga falta.
#
# No toca ninguna columna existente del monolito, solo agrega `formato`
# a `libros` (ver sql/02_formato_migracion.sql) y crea/actualiza el rol
# de minimo privilegio `libros_ms_svc`.
# =====================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTENEDOR_DB="${CONTENEDOR_DB:-libreria-db-1}"

if [[ ! -f "$RAIZ/.env" ]]; then
  echo "ERROR: falta $RAIZ/.env. Copia .env.example y rellenalo." >&2
  exit 1
fi

set -a; source "$RAIZ/.env"; set +a

: "${PGDATABASE:?}" "${PGADMIN_USER:?}" "${PGADMIN_PASSWORD:?}" "${PGPASSWORD:?}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTENEDOR_DB"; then
  echo "ERROR: el contenedor '$CONTENEDOR_DB' no esta corriendo." >&2
  exit 1
fi

# psql como la cuenta duena, dentro del contenedor de la BD.
psql_admin() {
  docker exec -i \
    -e PGPASSWORD="$PGADMIN_PASSWORD" \
    -e PGOPTIONS="-c client_min_messages=warning" \
    "$CONTENEDOR_DB" \
    psql -v ON_ERROR_STOP=1 -U "$PGADMIN_USER" -d "$PGDATABASE" "$@"
}

echo "==> 1/2  Migracion aditiva de la columna formato (sql/02_formato_migracion.sql)"
psql_admin -q < "$RAIZ/sql/02_formato_migracion.sql"

echo "==> 2/2  Rol de minimo privilegio (sql/01_minimo_privilegio_libros_ms.sql)"
# La contrasena viaja como variable de psql, no interpolada en el SQL.
psql_admin -q -v libros_password="'${PGPASSWORD}'" < "$RAIZ/sql/01_minimo_privilegio_libros_ms.sql"

echo
echo "==> Verificacion"
psql_admin -c '\d public.libros' -c '\du libros_ms_svc'

echo
echo "Listo. El unico cambio de esquema fue la columna aditiva 'formato'."

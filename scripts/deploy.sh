#!/usr/bin/env bash
# =====================================================================
# Ejercicio 04 -- Despliegue completo de libros-ms
# =====================================================================
# Idempotente. Aplica la migracion/rol, construye la imagen y levanta el
# servicio. No toca el monolito ni el contenido de release/ (eso lo
# genera scripts/empaquetar-clientes.sh por separado).
#
#   ./scripts/deploy.sh
# =====================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

azul() { printf '\033[36m==> %s\033[0m\n' "$1"; }

if [[ ! -f .env ]]; then
  echo "ERROR: falta .env. Copia .env.example y rellenalo." >&2
  exit 1
fi
set -a; source .env; set +a

# --- Requisitos --------------------------------------------------------
azul "Verificando el entorno"
for red in libreria_libreria-net services; do
  docker network inspect "$red" >/dev/null 2>&1 \
    || { echo "ERROR: falta la red Docker '$red'." >&2; exit 1; }
done
docker ps --format '{{.Names}}' | grep -qx libreria-db-1 \
  || { echo "ERROR: libreria-db-1 no esta corriendo (monolito del Ej. 02)." >&2; exit 1; }
echo "    redes y base de datos del monolito disponibles"

# --- Base de datos -----------------------------------------------------
azul "Aplicando migracion y rol de minimo privilegio"
./scripts/bootstrap-db.sh >/dev/null
echo "    columna 'formato' y rol libros_ms_svc al dia"

# --- Cliente de escritorio (release/) -----------------------------------
mkdir -p release

# --- Servicio ----------------------------------------------------------
azul "Construyendo y levantando el servicio"
docker compose up -d --build >/dev/null 2>&1

printf '    esperando a que este healthy'
for _ in $(seq 1 30); do
  estado="$(docker inspect -f '{{.State.Health.Status}}' libros-ms 2>/dev/null || echo starting)"
  [[ "$estado" == "healthy" ]] && break
  printf '.'
  sleep 2
done
echo

if [[ "$estado" != "healthy" ]]; then
  echo "ERROR: el contenedor no llego a healthy. Ultimos logs:" >&2
  docker compose logs --tail 30 libros-ms >&2
  exit 1
fi

# --- Comprobacion ------------------------------------------------------
azul "Comprobando"
echo "    /healthz  $(curl -fsS localhost:5001/healthz)"
curl -fsS localhost:5001/books >/dev/null && echo "    /books    responde"
curl -fsS localhost:5001/download-client >/dev/null && echo "    /download-client responde"

echo
echo "Servicio local:   http://localhost:5001"
echo "Servicio publico: ${LIBROS_ENDPOINT_PUBLICO}"
echo
if ! curl -fsS --max-time 8 "${LIBROS_ENDPOINT_PUBLICO}/healthz" >/dev/null 2>&1; then
  cat <<'AVISO'
El hostname publico todavia no responde. Falta darlo de alta en Cloudflare:

  Zero Trust -> Networks -> Tunnels -> tu tunel -> Public Hostnames -> Add

    Subdomain : libros
    Domain    : maxthecoder.online
    Type      : HTTP
    URL       : libros-ms:8000

  (el tunel llega por la red docker 'services' directo al puerto interno
  del contenedor, no por el puerto publicado en 127.0.0.1:5001)

AVISO
else
  echo "El hostname publico responde correctamente."
fi

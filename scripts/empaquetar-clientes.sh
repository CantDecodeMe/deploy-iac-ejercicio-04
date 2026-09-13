#!/usr/bin/env bash
# =====================================================================
# Ejercicio 04 -- Empaqueta el cliente Electron para Windows y Linux
# =====================================================================
# Corre en el Pi (ARM64/Linux). electron-packager no compila nada: baja
# el binario prebuilt de Electron para cada plataforma/arquitectura, asi
# que el .zip de Windows se genera aqui sin Wine y sin una maquina
# Windows.
#
#   ./scripts/empaquetar-clientes.sh
#
# Salida en release/ (gitignored):
#   libros-ms-client-win32-x64.zip     -- descomprimir y ejecutar el .exe
#   libros-ms-client-linux-x64.zip     -- descomprimir y ejecutar ./run.sh
# =====================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$RAIZ/apps/Electron_app"
NPM="node $RAIZ/tools/npm/bin/npm-cli.js"
RELEASE_DIR="$RAIZ/release"

azul() { printf '\033[36m==> %s\033[0m\n' "$1"; }

cd "$APP_DIR"

if [[ ! -d node_modules ]]; then
  echo "ERROR: falta node_modules. Corre primero:" >&2
  echo "  node $RAIZ/tools/npm/bin/npm-cli.js install" >&2
  exit 1
fi

azul "Verificando el entorno"
$NPM run check:env

azul "Corriendo las pruebas de los modulos puros"
$NPM test

mkdir -p "$RELEASE_DIR"
rm -rf "$RELEASE_DIR"/libros-ms-client-win32-x64 "$RELEASE_DIR"/libros-ms-client-linux-x64
rm -f "$RELEASE_DIR"/libros-ms-client-win32-x64.zip "$RELEASE_DIR"/libros-ms-client-linux-x64.zip

azul "Empaquetando para Windows (win32-x64)"
$NPM run package:win

azul "Empaquetando para Linux (linux-x64)"
$NPM run package:linux

azul "Armando el cliente portable de Linux (run.sh)"
DIR_LINUX="$RELEASE_DIR/libros-ms-client-linux-x64"
cat > "$DIR_LINUX/run.sh" <<'SCRIPT'
#!/usr/bin/env bash
# Ejecuta el cliente desde donde sea que se haya descomprimido el .zip.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/libros-ms-client" "$@"
SCRIPT
chmod +x "$DIR_LINUX/run.sh"

azul "Comprimiendo los entregables"
(cd "$RELEASE_DIR" && zip -rq libros-ms-client-win32-x64.zip libros-ms-client-win32-x64)
(cd "$RELEASE_DIR" && zip -rq libros-ms-client-linux-x64.zip libros-ms-client-linux-x64)

# Las carpetas sin comprimir no se publican, solo el zip que sirve
# /download-client.
rm -rf "$RELEASE_DIR"/libros-ms-client-win32-x64 "$RELEASE_DIR"/libros-ms-client-linux-x64

echo
ls -lh "$RELEASE_DIR"/*.zip
echo
echo "Listo. Disponibles en https://libros.maxthecoder.online/download-client"

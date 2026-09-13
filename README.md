# Ejercicio 04 · libros-ms + cliente Electron

Microservicio REST/XML de solo lectura sobre el catalogo de la libreria, mas un
cliente de escritorio (Electron) que lo consume. Comparte la base PostgreSQL
del monolito del Ejercicio 02 (`libreria-db-1`) y convive con el modulo SOAP
del Ejercicio 03 sobre la misma base -- no modifica el codigo de ninguno de
los dos, y el unico cambio de esquema es la columna aditiva `formato`
(ver [Decisiones de ingenieria](#decisiones-de-ingenieria)).

> **Nota sobre el enunciado.** La consigna original (`enunciados/Ejercicio-04.md`
> en el journal) apunta a un microservicio de ejemplo del curso
> (`http://34.51.99.221:5001/books`). Aqui se construyo un microservicio propio
> siguiendo el mismo patron de infraestructura que ej02/ej03, y la app Electron
> lo usa como valor por defecto -- pero el requisito real (URL y endpoint
> configurables, persistidos en `localStorage`) se cumple igual, asi que
> tambien funciona apuntando al servidor del curso o a cualquier otro que
> hable el mismo contrato XML.

| | |
|---|---|
| Endpoint | `https://libros.maxthecoder.online/books` |
| Contrato | `https://libros.maxthecoder.online/openapi.json` |
| Descargas | `https://libros.maxthecoder.online/download-client` |
| Local (loopback) | `http://localhost:5001` |
| Reporte tecnico (en vivo) | `https://journal-iac.maxthecoder.online/activities/04/` |
| Codigo fuente | `https://github.com/CantDecodeMe/deploy-iac-ejercicio-04` |

---

## Desplegar

```bash
cp .env.example .env
chmod 600 .env
./scripts/deploy.sh
```

### Paso manual: alta del hostname publico en Cloudflare

| Campo | Valor |
|---|---|
| Subdomain | `libros` |
| Domain | `maxthecoder.online` |
| Type | `HTTP` |
| URL | `libros-ms:8000` |

El tunel llega a `libros-ms` por la red docker `services`, directo al puerto
interno del contenedor -- no por el puerto publicado en `127.0.0.1:5001`.

---

## Estructura

```text
docker-compose.yml          # un solo servicio, red del monolito externa
.env.example                # plantilla de configuracion (PG*, endpoint publico)
service/                    # Flask + gunicorn
  app.py                    # rutas HTTP/XML
  xml_util.py               # serializacion del contrato (ElementTree, sin f-strings)
  config/settings.py        # configuracion desde el entorno, sin defaults en secretos
  db/pool.py                # pool de conexiones + transaccion()
  db/repositorio.py         # el unico modulo que escribe SQL, todo parametrizado
sql/
  01_minimo_privilegio_libros_ms.sql   # rol libros_ms_svc, solo lectura
  02_formato_migracion.sql             # columna aditiva `formato`
scripts/
  bootstrap-db.sh            # aplica sql/ contra libreria-db-1, idempotente
  deploy.sh                  # build + up + healthcheck + verificacion
  empaquetar-clientes.sh     # genera release/ (Windows + Linux) sin Wine
release/                     # gitignored -- lo genera empaquetar-clientes.sh
apps/
  Electron_app/              # cliente de escritorio
```

## Operaciones

| Ruta | Descripcion |
|---|---|
| `GET /books` | Catalogo, con filtros `format`, `isbn`, `title`, `year`, `min_price`, `max_price`, y paginacion `page`/`per_page` |
| `GET /books/<isbn>` | Un libro |
| `GET /uploads/<archivo>` | Portadas del catalogo (solo lectura, montadas desde el monolito) |
| `GET /download-client` | Pagina con los clientes de escritorio empaquetados |
| `GET /healthz` | Estado del servicio y de la conexion a PostgreSQL |
| `GET /openapi.json` | Contrato de la API |

## Probar

```bash
curl -fsS http://localhost:5001/healthz
curl -fsS http://localhost:5001/books | head
curl -I http://localhost:5001/download-client
```

## Cliente de escritorio desde tu laptop

1. Entra a `https://libros.maxthecoder.online/download-client`.
2. Descarga el paquete de tu sistema operativo.
3. **Windows 11**: descomprime el `.zip` y ejecuta `libros-ms-client.exe`.
   **Linux**: descomprime y ejecuta `./run.sh`.

No hace falta instalar Node ni Electron en tu laptop -- el paquete ya trae el
runtime. Pasos detallados (incluida la advertencia de SmartScreen en Windows)
en [`apps/Electron_app/README.md`](apps/Electron_app/README.md).

## Desarrollar y empaquetar el cliente Electron

Este repo no depende de un `npm` global -- se vendoriza en `tools/npm/`
(descargado del registro, no versionado) porque el Pi donde se desarrollo
solo tiene el binario `node`, sin `npm`:

```bash
cd apps/Electron_app
node ../../tools/npm/bin/npm-cli.js install
node ../../tools/npm/bin/npm-cli.js run check:env
node ../../tools/npm/bin/npm-cli.js test              # 17 casos, node --test puro
cd ../..
./scripts/empaquetar-clientes.sh                       # genera release/*.zip (Windows + Linux)
```

`empaquetar-clientes.sh` corre las pruebas antes de empaquetar y falla si no
pasan. Los `.zip` resultantes se sirven desde `/download-client` -- no se
versionan en git.

## Decisiones de ingenieria

**Columna `formato` agregada al monolito.** El contrato de `/books` pide un
filtro por formato que no existia en el esquema del Ejercicio 02. En vez de
omitir el filtro o hardcodear un valor sin persistirlo, se agrego una
migracion aditiva (`ALTER TABLE libros ADD COLUMN formato text NOT NULL
DEFAULT 'Fisico'`) aplicada en caliente contra `libreria-db-1`. Se verifico
antes de aplicarla que ninguna escritura existente en el monolito (Ejercicio
02) ni en el modulo SOAP (Ejercicio 03) usa INSERT/UPDATE posicional, `SELECT
*` con acceso por indice, ni un validador de esquema que rechace un campo
extra -- por lo que la migracion es segura sin tocar el codigo de ninguno de
los dos.

**Rol de minimo privilegio.** `libros_ms_svc` solo tiene `SELECT` sobre las
tablas que expone el contrato (`libros`, `categorias`, `autores`,
`libro_autor`, `editoriales`, `conceptos`); todo lo demas (`usuarios`,
`pedidos`, `detalle_pedido`, `sesiones`) esta explicitamente revocado.

**Portadas re-servidas por el propio microservicio.** El contrato exige que
`<portada>` sea resuelta por libros-ms, asi que el contenedor monta
`/home/pi/libreria/uploads` de solo lectura y la re-sirve en `/uploads/...`,
en vez de solo devolver la ruta y depender de que el cliente conozca la URL
del monolito.

**Fetch en el proceso main de Electron, no en el renderer.** Evita CORS del
lado del servidor y evita que el renderer tenga acceso directo a la red. El
preload corre con `sandbox: false` -- necesario porque el sandbox de Electron
restringe el `require()` del preload a modulos nativos de Node, no a
archivos locales del proyecto -- pero el renderer sigue sin
`nodeIntegration`, ya que la app solo carga su propio `index.html`.

**Parser XML propio, sin dependencias.** El contrato de `libros-ms` es
simple (sin namespaces, sin CDATA), asi que un parser minimo en
`src/shared/parseXml.js` evita traer una libreria completa y permite
probar los modulos puros con `node --test` sin instalar nada. Un bug real
de esta simplicidad -- `xml.etree.ElementTree` serializa un campo vacio
como tag self-closing (`<year />`), y la regex de atributos original se
tragaba esa barra -- se encontro corriendo la app contra datos reales y
quedo cubierto con una prueba de regresion.

**Empaquetado sin Wine.** `electron-packager` descarga los binarios
prebuilt de Electron para cada plataforma (no compila nada), asi que se
puede generar el `.zip` de Windows desde el Raspberry Pi (ARM64/Linux) sin
necesitar Wine ni una maquina Windows. La parte no obvia: el paquete
infiere `appVersion` del campo `version` de `package.json`, y *cualquier*
valor de `appVersion` (inferido o explicito) obliga a correr `rcedit` --
un editor de recursos de Windows -- via Wine. Se quito `version` de
`package.json` (la app es privada, no se publica) para evitar la
inferencia por completo.

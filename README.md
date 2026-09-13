# Ejercicio 04 · libros-ms + cliente Electron

Microservicio REST/XML de solo lectura sobre el catalogo de la libreria, mas un
cliente de escritorio (Electron) que lo consume. Comparte la base PostgreSQL
del monolito del Ejercicio 02 (`libreria-db-1`) y convive con el modulo SOAP
del Ejercicio 03 sobre la misma base -- no modifica el codigo de ninguno de
los dos, y el unico cambio de esquema es la columna aditiva `formato`
(ver [Decisiones de ingenieria](#decisiones-de-ingenieria)).

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
3. **Linux**: descomprime y ejecuta `./run.sh`. **Windows**: descomprime y
   ejecuta el `.exe` incluido en el `.zip`.

No hace falta instalar Node ni Electron en tu laptop -- el paquete ya trae el
runtime.

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

**Empaquetado sin Wine.** `electron-packager` descarga los binarios
prebuilt de Electron para cada plataforma (no compila nada), asi que se
puede generar el `.zip` de Windows desde el Raspberry Pi (ARM64/Linux) sin
necesitar Wine ni una maquina Windows.

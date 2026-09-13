"""libros-ms -- microservicio REST/XML sobre el catalogo de la libreria.

Flask solo hace de transporte: valida la entrada, delega en `db/` y
serializa con `xml_util`. Es de solo lectura -- ni una ruta escribe en la
base -- y comparte el Postgres del monolito del Ejercicio 02 sin
modificar su esquema salvo por la columna aditiva `formato`
(sql/02_formato_migracion.sql).

Rutas:
    GET  /                        portada humana con el estado y los enlaces
    GET  /healthz                 sonda para Docker y el tunel
    GET  /openapi.json            contrato de la API
    GET  /books                   catalogo, con filtros y paginacion
    GET  /books/<isbn>            un libro
    GET  /uploads/<archivo>       portadas de libros (solo lectura)
    GET  /download-client         pagina con los clientes de escritorio
    GET  /download-client/<nombre> descarga del cliente empaquetado
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory

sys.path.insert(0, str(Path(__file__).parent))

from config import settings  # noqa: E402
from db import pool, repositorio  # noqa: E402
import xml_util  # noqa: E402

cfg = settings.cargar()

logging.basicConfig(
    level=getattr(logging, cfg.log_level, logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s :: %(message)s",
)
log = logging.getLogger("libros-ms")

app = Flask(__name__)
pool.iniciar(cfg.dsn)


# --- Validacion de querystring ------------------------------------------


class ParametroInvalido(ValueError):
    """Un filtro de /books no se pudo interpretar."""


def _entero_opcional(nombre: str) -> int | None:
    valor = request.args.get(nombre)
    if valor is None or valor == "":
        return None
    try:
        return int(valor)
    except ValueError:
        raise ParametroInvalido(f"El parametro '{nombre}' debe ser un entero.") from None


def _decimal_opcional(nombre: str) -> float | None:
    valor = request.args.get(nombre)
    if valor is None or valor == "":
        return None
    try:
        return float(valor)
    except ValueError:
        raise ParametroInvalido(f"El parametro '{nombre}' debe ser un numero.") from None


def _pagina_y_limite() -> tuple[int, int]:
    pagina = _entero_opcional("page") or 1
    if pagina < 1:
        raise ParametroInvalido("El parametro 'page' debe ser mayor o igual a 1.")

    por_pagina = _entero_opcional("per_page") or cfg.limite_paginacion_defecto
    if por_pagina < 1 or por_pagina > cfg.limite_paginacion_maximo:
        raise ParametroInvalido(
            f"El parametro 'per_page' debe estar entre 1 y {cfg.limite_paginacion_maximo}."
        )
    return pagina, por_pagina


# --- Catalogo ------------------------------------------------------------


@app.get("/books")
def listar_books():
    try:
        pagina, por_pagina = _pagina_y_limite()
        anio = _entero_opcional("year")
        precio_min = _decimal_opcional("min_price")
        precio_max = _decimal_opcional("max_price")
    except ParametroInvalido as exc:
        return Response(str(exc), status=400, mimetype="text/plain; charset=utf-8")

    with pool.transaccion() as cur:
        libros, total = repositorio.listar_libros(
            cur,
            formato=request.args.get("format") or None,
            isbn=request.args.get("isbn") or None,
            titulo=request.args.get("title") or None,
            anio=anio,
            precio_min=precio_min,
            precio_max=precio_max,
            limite=por_pagina,
            offset=(pagina - 1) * por_pagina,
        )

    xml = xml_util.libros_a_xml(
        libros, base_url=cfg.endpoint_publico, total=total, pagina=pagina, por_pagina=por_pagina
    )
    return Response(xml, mimetype="application/xml; charset=utf-8")


@app.get("/books/<isbn>")
def obtener_book(isbn: str):
    with pool.transaccion() as cur:
        libro = repositorio.obtener_libro_por_isbn(cur, isbn)

    if libro is None:
        return Response(
            f'<?xml version="1.0" encoding="UTF-8"?>\n<error>No existe un libro con isbn "{isbn}".</error>',
            status=404,
            mimetype="application/xml; charset=utf-8",
        )

    xml = xml_util.libro_a_xml(libro, base_url=cfg.endpoint_publico)
    return Response(xml, mimetype="application/xml; charset=utf-8")


# --- Portadas --------------------------------------------------------------


@app.get("/uploads/<path:nombre>")
def portada_libro(nombre: str):
    # send_from_directory bloquea el path traversal; el volumen ademas se
    # monta de solo lectura sobre el directorio real del monolito.
    return send_from_directory(cfg.dir_uploads, nombre)


# --- Cliente de escritorio ---------------------------------------------


@app.get("/download-client")
def pagina_descarga():
    dir_release = Path(cfg.dir_release)
    windows = sorted(dir_release.glob("*win*.zip")) if dir_release.is_dir() else []
    linux = sorted(dir_release.glob("*linux*.zip")) if dir_release.is_dir() else []

    def _boton(archivos: list[Path], etiqueta: str) -> str:
        if not archivos:
            return f"<p>{etiqueta}: aun no publicado.</p>"
        nombre = archivos[-1].name
        return f'<a class="boton" href="/download-client/{nombre}">Descargar para {etiqueta}</a>'

    return Response(
        PAGINA_DESCARGA.format(
            boton_windows=_boton(windows, "Windows"),
            boton_linux=_boton(linux, "Linux"),
        ),
        mimetype="text/html; charset=utf-8",
    )


@app.get("/download-client/<path:nombre>")
def descargar_cliente(nombre: str):
    return send_from_directory(cfg.dir_release, nombre, as_attachment=True)


# --- Operacion y salud ---------------------------------------------------


@app.get("/healthz")
def healthz():
    ok = pool.esta_viva()
    return jsonify(status="ok" if ok else "degradado", db="ok" if ok else "error"), (
        200 if ok else 503
    )


@app.get("/openapi.json")
def openapi():
    return jsonify(_openapi_spec())


def _openapi_spec() -> dict:
    def parametro_filtro(nombre: str, tipo: str, descripcion: str) -> dict:
        return {
            "name": nombre,
            "in": "query",
            "required": False,
            "schema": {"type": tipo},
            "description": descripcion,
        }

    return {
        "openapi": "3.0.3",
        "info": {
            "title": "libros-ms",
            "version": "1.0.0",
            "description": (
                "Catalogo de la libreria en solo lectura, sobre la misma base "
                "PostgreSQL de los Ejercicios 02 y 03."
            ),
        },
        "servers": [{"url": cfg.endpoint_publico}],
        "paths": {
            "/books": {
                "get": {
                    "summary": "Lista libros con filtros y paginacion",
                    "parameters": [
                        parametro_filtro("format", "string", "Formato del libro (p. ej. Fisico)."),
                        parametro_filtro("isbn", "string", "ISBN exacto."),
                        parametro_filtro("title", "string", "Coincidencia parcial del titulo."),
                        parametro_filtro("year", "integer", "Anio de publicacion."),
                        parametro_filtro("min_price", "number", "Precio minimo."),
                        parametro_filtro("max_price", "number", "Precio maximo."),
                        parametro_filtro("page", "integer", "Pagina, iniciando en 1."),
                        parametro_filtro("per_page", "integer", "Resultados por pagina."),
                    ],
                    "responses": {"200": {"description": "OK", "content": {"application/xml": {}}}},
                }
            },
            "/books/{isbn}": {
                "get": {
                    "summary": "Obtiene un libro por ISBN",
                    "parameters": [
                        {
                            "name": "isbn",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"},
                        }
                    ],
                    "responses": {
                        "200": {"description": "OK", "content": {"application/xml": {}}},
                        "404": {"description": "No existe un libro con ese ISBN."},
                    },
                }
            },
            "/healthz": {
                "get": {
                    "summary": "Estado del servicio y de la conexion a la base",
                    "responses": {"200": {"description": "OK"}, "503": {"description": "Degradado"}},
                }
            },
            "/download-client": {
                "get": {"summary": "Pagina con los clientes de escritorio empaquetados"}
            },
        },
    }


@app.get("/")
def portada():
    return Response(PORTADA.format(endpoint=cfg.endpoint_publico), mimetype="text/html; charset=utf-8")


PORTADA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>libros-ms · Catalogo de la libreria</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{ margin:0; padding:48px 24px; font:15px/1.6 ui-sans-serif,system-ui,sans-serif;
         max-width:640px; margin-inline:auto; }}
  h1 {{ font-size:1.5rem; margin:0 0 4px; }}
  p.sub {{ margin:0 0 32px; opacity:.7; }}
  code {{ font-family:ui-monospace,monospace; font-size:.9em;
          background:rgba(128,128,128,.15); padding:2px 5px; border-radius:4px; }}
  ul {{ padding-left:18px; }} li {{ margin:6px 0; }}
</style></head><body>
<h1>libros-ms · Catalogo de la libreria</h1>
<p class="sub">Ejercicio 04 · Integracion de Aplicaciones Computacionales · UDEM</p>

<p>Microservicio REST/XML de solo lectura sobre el catalogo de libros.
Comparte la base PostgreSQL del monolito (Ejercicio 02) sin modificar su
esquema, salvo por la columna aditiva <code>formato</code>.</p>

<ul>
  <li>Catalogo: <a href="/books"><code>/books</code></a></li>
  <li>Contrato: <a href="/openapi.json"><code>/openapi.json</code></a></li>
  <li>Cliente de escritorio: <a href="/download-client"><code>/download-client</code></a></li>
  <li>Salud: <a href="/healthz"><code>/healthz</code></a></li>
</ul>
</body></html>
"""

PAGINA_DESCARGA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Descargar cliente · libros-ms</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{ margin:0; padding:48px 24px; font:15px/1.6 ui-sans-serif,system-ui,sans-serif;
         max-width:520px; margin-inline:auto; text-align:center; }}
  h1 {{ font-size:1.4rem; }}
  .boton {{ display:inline-block; margin:12px 8px; padding:12px 20px; border-radius:8px;
            background:#2563eb; color:#fff; text-decoration:none; font-weight:600; }}
  .boton:hover {{ background:#1d4ed8; }}
  p {{ opacity:.75; }}
</style></head><body>
<h1>Cliente de escritorio · libros-ms</h1>
<p>Explora el catalogo con la aplicacion Electron. Elige tu sistema operativo:</p>
{boton_windows}
{boton_linux}
</body></html>
"""


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)

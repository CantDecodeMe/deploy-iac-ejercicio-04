"""Configuracion de libros-ms, leida del entorno.

Ni una credencial tiene valor por defecto: si falta, el servicio no
arranca. Mismo criterio que ej03: arranque fallido y ruidoso antes que un
servicio en pie con una contrasena adivinable.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


class ErrorDeConfiguracion(RuntimeError):
    """El entorno no trae lo minimo para arrancar."""


def _requerido(nombre: str) -> str:
    valor = os.environ.get(nombre, "").strip()
    if not valor:
        raise ErrorDeConfiguracion(
            f"Falta la variable de entorno {nombre}. Revisa el archivo .env."
        )
    return valor


def _entero(nombre: str, defecto: int) -> int:
    try:
        return int(os.environ.get(nombre, defecto))
    except ValueError:
        return defecto


@dataclass(frozen=True)
class Configuracion:
    # PostgreSQL -- cuenta de servicio de minimo privilegio (libros_ms_svc)
    pg_host: str
    pg_port: int
    pg_database: str
    pg_user: str
    pg_password: str

    # Servicio
    endpoint_publico: str
    log_level: str
    dir_uploads: str
    dir_release: str

    # Paginacion por defecto de /books cuando el cliente no la especifica.
    limite_paginacion_defecto: int
    limite_paginacion_maximo: int

    @property
    def dsn(self) -> str:
        return (
            f"host={self.pg_host} port={self.pg_port} dbname={self.pg_database} "
            f"user={self.pg_user} password={self.pg_password} "
            f"application_name=libros-ms connect_timeout=5"
        )


def cargar() -> Configuracion:
    return Configuracion(
        pg_host=os.environ.get("PGHOST", "libreria-db-1"),
        pg_port=_entero("PGPORT", 5432),
        pg_database=os.environ.get("PGDATABASE", "libreria"),
        pg_user=_requerido("PGUSER"),
        pg_password=_requerido("PGPASSWORD"),
        endpoint_publico=os.environ.get(
            "LIBROS_ENDPOINT_PUBLICO", "https://libros.maxthecoder.online"
        ).rstrip("/"),
        log_level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        dir_uploads=os.environ.get("DIR_UPLOADS", "/app/uploads"),
        dir_release=os.environ.get("DIR_RELEASE", "/app/release"),
        limite_paginacion_defecto=_entero("LIMITE_PAGINACION_DEFECTO", 8),
        limite_paginacion_maximo=_entero("LIMITE_PAGINACION_MAXIMO", 50),
    )

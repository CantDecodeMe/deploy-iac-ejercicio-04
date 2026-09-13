"""Pool de conexiones y unidad de trabajo transaccional.

Todo acceso a PostgreSQL pasa por `transaccion()`. Es el unico lugar del
proyecto donde se hace COMMIT o ROLLBACK. libros-ms es de solo lectura,
pero se mantiene el mismo patron transaccional que ej03 para no depender
de la disciplina de cada handler.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from threading import Lock

import psycopg2
import psycopg2.extras
from psycopg2 import pool as pg_pool

log = logging.getLogger(__name__)

_pool: pg_pool.SimpleConnectionPool | None = None
_candado = Lock()


def iniciar(dsn: str, minimo: int = 1, maximo: int = 8) -> None:
    global _pool
    with _candado:
        if _pool is None:
            _pool = pg_pool.SimpleConnectionPool(minimo, maximo, dsn)
            log.info("Pool de PostgreSQL iniciado (%d-%d conexiones)", minimo, maximo)


def cerrar() -> None:
    global _pool
    with _candado:
        if _pool is not None:
            _pool.closeall()
            _pool = None


@contextmanager
def transaccion():
    """Entrega un cursor dict dentro de una transaccion.

    Commit al salir sin excepcion, rollback ante cualquier error, y la
    conexion siempre vuelve al pool (incluso si el rollback falla porque
    la conexion murio).
    """
    if _pool is None:
        raise RuntimeError("El pool no esta iniciado; llama a iniciar() primero.")

    conexion = _pool.getconn()
    roto = False
    try:
        with conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        conexion.commit()
    except Exception:
        try:
            conexion.rollback()
        except psycopg2.Error:
            # La conexion ya no sirve; no se devuelve al pool envenenada.
            roto = True
        raise
    finally:
        _pool.putconn(conexion, close=roto)


def esta_viva() -> bool:
    """Sonda para /healthz."""
    try:
        with transaccion() as cur:
            cur.execute("SELECT 1 AS ok")
            return cur.fetchone()["ok"] == 1
    except Exception:
        log.exception("La sonda de PostgreSQL fallo")
        return False

"""Capa de acceso a datos. El unico modulo del proyecto que escribe SQL.

Regla del enunciado, igual que en ej03: nada de SQL concatenado con
entradas del usuario. Todos los valores viajan como parametros de
psycopg2 (`%s`); el texto de las consultas es constante.

libros-ms es de solo lectura: no hay ni un INSERT/UPDATE/DELETE en este
archivo, y el rol `libros_ms_svc` con el que se conecta tampoco tiene
permiso para hacerlos (ver sql/01_minimo_privilegio_libros_ms.sql).
"""

from __future__ import annotations

from typing import Any


def listar_libros(
    cur,
    *,
    formato: str | None,
    isbn: str | None,
    titulo: str | None,
    anio: int | None,
    precio_min: float | None,
    precio_max: float | None,
    limite: int,
    offset: int,
) -> tuple[list[dict], int]:
    condiciones: list[str] = []
    parametros: list[Any] = []

    if formato:
        condiciones.append("l.formato ILIKE %s")
        parametros.append(formato)
    if isbn:
        condiciones.append("l.isbn = %s")
        parametros.append(isbn)
    if titulo:
        condiciones.append("l.titulo ILIKE %s")
        parametros.append(f"%{titulo}%")
    if anio is not None:
        condiciones.append("EXTRACT(YEAR FROM l.fecha_publicacion) = %s")
        parametros.append(anio)
    if precio_min is not None:
        condiciones.append("l.precio >= %s")
        parametros.append(precio_min)
    if precio_max is not None:
        condiciones.append("l.precio <= %s")
        parametros.append(precio_max)

    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

    sql = f"""
        SELECT l.libro_id, l.isbn, l.titulo, l.descripcion, l.precio, l.stock,
               l.portada, l.formato, l.fecha_publicacion,
               cat.nombre AS genero,
               ed.nombre AS editorial,
               COALESCE(
                 (SELECT json_agg(a.nombre ORDER BY a.nombre)
                    FROM libro_autor la
                    JOIN autores a ON a.autor_id = la.autor_id
                   WHERE la.libro_id = l.libro_id),
                 '[]'::json
               ) AS autores,
               COALESCE(
                 (SELECT json_agg(
                           json_build_object('termino', co.termino, 'definicion', co.definicion)
                           ORDER BY co.orden, co.concepto_id
                         )
                    FROM conceptos co
                   WHERE co.libro_id = l.libro_id),
                 '[]'::json
               ) AS conceptos,
               COUNT(*) OVER() AS total_filas
          FROM libros l
          LEFT JOIN categorias c ON c.categoria_id = l.categoria_id
          LEFT JOIN editoriales ed ON ed.editorial_id = l.editorial_id
          {where}
         ORDER BY l.libro_id
         LIMIT %s OFFSET %s
    """
    parametros.extend([limite, offset])

    cur.execute(sql, parametros)
    filas = cur.fetchall()
    total = filas[0]["total_filas"] if filas else 0
    return filas, total


def obtener_libro_por_isbn(cur, isbn: str) -> dict | None:
    sql = """
        SELECT l.libro_id, l.isbn, l.titulo, l.descripcion, l.precio, l.stock,
               l.portada, l.formato, l.fecha_publicacion,
               cat.nombre AS genero,
               ed.nombre AS editorial,
               COALESCE(
                 (SELECT json_agg(a.nombre ORDER BY a.nombre)
                    FROM libro_autor la
                    JOIN autores a ON a.autor_id = la.autor_id
                   WHERE la.libro_id = l.libro_id),
                 '[]'::json
               ) AS autores,
               COALESCE(
                 (SELECT json_agg(
                           json_build_object('termino', co.termino, 'definicion', co.definicion)
                           ORDER BY co.orden, co.concepto_id
                         )
                    FROM conceptos co
                   WHERE co.libro_id = l.libro_id),
                 '[]'::json
               ) AS conceptos
          FROM libros l
          LEFT JOIN categorias c ON c.categoria_id = l.categoria_id
          LEFT JOIN editoriales ed ON ed.editorial_id = l.editorial_id
         WHERE l.isbn = %s
    """
    cur.execute(sql, (isbn,))
    return cur.fetchone()

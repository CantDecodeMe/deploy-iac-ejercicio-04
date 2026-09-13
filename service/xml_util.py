"""Serializacion del contrato XML de libros-ms.

Se arma el XML a mano con xml.etree.ElementTree (nunca con f-strings ni
concatenacion) para que el escape de &, < y > en titulos, autores o
definiciones lo haga la libreria estandar, no un reemplazo manual que se
olvide un caso.
"""

from __future__ import annotations

from xml.etree import ElementTree as ET


def _texto(valor) -> str:
    return "" if valor is None else str(valor)


def libro_a_elemento(libro: dict, *, base_url: str) -> ET.Element:
    book = ET.Element("book")
    ET.SubElement(book, "isbn").text = _texto(libro.get("isbn"))
    ET.SubElement(book, "title").text = _texto(libro.get("titulo"))
    ET.SubElement(book, "genero").text = _texto(libro.get("genero"))
    ET.SubElement(book, "formato").text = _texto(libro.get("formato"))
    ET.SubElement(book, "editorial").text = _texto(libro.get("editorial"))

    fecha = libro.get("fecha_publicacion")
    ET.SubElement(book, "year").text = str(fecha.year) if fecha else ""

    portada = libro.get("portada")
    ET.SubElement(book, "portada").text = f"{base_url}{portada}" if portada else ""

    ET.SubElement(book, "price").text = _texto(libro.get("precio"))
    ET.SubElement(book, "stock").text = _texto(libro.get("stock"))

    authors_el = ET.SubElement(book, "authors")
    for nombre in libro.get("autores") or []:
        ET.SubElement(authors_el, "author").text = nombre

    concepts_el = ET.SubElement(book, "concepts")
    for concepto in libro.get("conceptos") or []:
        concept_el = ET.SubElement(concepts_el, "concept")
        ET.SubElement(concept_el, "termino").text = concepto["termino"]
        ET.SubElement(concept_el, "definicion").text = concepto["definicion"]

    return book


def _serializar(elemento: ET.Element) -> str:
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(elemento, encoding="unicode")


def libros_a_xml(libros: list[dict], *, base_url: str, total: int, pagina: int, por_pagina: int) -> str:
    root = ET.Element(
        "books",
        attrib={"total": str(total), "page": str(pagina), "per_page": str(por_pagina)},
    )
    for libro in libros:
        root.append(libro_a_elemento(libro, base_url=base_url))
    return _serializar(root)


def libro_a_xml(libro: dict, *, base_url: str) -> str:
    return _serializar(libro_a_elemento(libro, base_url=base_url))

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseBooksXml, parseBookXml } = require('../src/shared/parseXml');

const XML_DOS_LIBROS = `<?xml version="1.0" encoding="UTF-8"?>
<books total="10" page="1" per_page="2">
  <book>
    <isbn>978-0307474728</isbn>
    <title>Cien años de soledad</title>
    <genero>Ficción</genero>
    <formato>Fisico</formato>
    <editorial>Alfaguara</editorial>
    <year>1967</year>
    <portada>https://libros.maxthecoder.online/uploads/seed/portada1.svg</portada>
    <price>19.90</price>
    <stock>12</stock>
    <authors><author>Gabriel García Márquez</author></authors>
    <concepts>
      <concept><termino>Macondo</termino><definicion>Pueblo ficticio &amp; escenario central.</definicion></concept>
    </concepts>
  </book>
  <book>
    <isbn>978-8499926223</isbn>
    <title>Sapiens</title>
    <genero>Historia</genero>
    <formato>Fisico</formato>
    <editorial>Planeta</editorial>
    <year>2014</year>
    <portada></portada>
    <price>22.50</price>
    <stock>8</stock>
    <authors><author>Yuval Noah Harari</author></authors>
    <concepts></concepts>
  </book>
</books>`;

test('parseBooksXml lee los atributos de paginacion', () => {
  const resultado = parseBooksXml(XML_DOS_LIBROS);
  assert.equal(resultado.total, 10);
  assert.equal(resultado.page, 1);
  assert.equal(resultado.perPage, 2);
  assert.equal(resultado.books.length, 2);
});

test('parseBooksXml mapea todos los campos de un libro', () => {
  const [libro] = parseBooksXml(XML_DOS_LIBROS).books;
  assert.equal(libro.isbn, '978-0307474728');
  assert.equal(libro.title, 'Cien años de soledad');
  assert.equal(libro.genero, 'Ficción');
  assert.equal(libro.formato, 'Fisico');
  assert.equal(libro.editorial, 'Alfaguara');
  assert.equal(libro.year, '1967');
  assert.equal(libro.portada, 'https://libros.maxthecoder.online/uploads/seed/portada1.svg');
  assert.equal(libro.price, '19.90');
  assert.equal(libro.stock, '12');
  assert.deepEqual(libro.authors, ['Gabriel García Márquez']);
  assert.deepEqual(libro.concepts, [
    { termino: 'Macondo', definicion: 'Pueblo ficticio & escenario central.' },
  ]);
});

test('parseBooksXml tolera portada vacia y sin conceptos', () => {
  const [, segundo] = parseBooksXml(XML_DOS_LIBROS).books;
  assert.equal(segundo.portada, '');
  assert.deepEqual(segundo.concepts, []);
});

test('parseBooksXml soporta tags self-closing para campos vacios (año sin fecha)', () => {
  // xml.etree.ElementTree serializa un elemento con texto="" como
  // self-closing (<year />), no como <year></year>. Es justo lo que
  // devuelve libros-ms para un libro sin fecha_publicacion.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <books total="1" page="1" per_page="1">
      <book>
        <isbn>1</isbn>
        <title>Sin fecha</title>
        <year />
        <portada />
        <authors><author>Autor</author></authors>
        <concepts />
      </book>
    </books>`;
  const [libro] = parseBooksXml(xml).books;
  assert.equal(libro.year, '');
  assert.equal(libro.portada, '');
  assert.deepEqual(libro.concepts, []);
  assert.deepEqual(libro.authors, ['Autor']);
});

test('parseBooksXml exige el elemento raiz <books>', () => {
  assert.throws(() => parseBooksXml('<otracosa></otracosa>'), /falta el elemento raiz/);
});

test('parseBooksXml detecta XML mal formado', () => {
  assert.throws(() => parseBooksXml('<books><book></books>'), /XML mal formado/);
});

test('parseBookXml lee un solo libro como raiz', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <book><isbn>123</isbn><title>Titulo</title><authors><author>A</author></authors><concepts></concepts></book>`;
  const libro = parseBookXml(xml);
  assert.equal(libro.isbn, '123');
  assert.equal(libro.title, 'Titulo');
  assert.deepEqual(libro.authors, ['A']);
});

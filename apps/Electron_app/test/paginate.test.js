'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularPaginacion } = require('../src/shared/paginate');

test('calcula el total de paginas redondeando hacia arriba', () => {
  const estado = calcularPaginacion({ total: 10, page: 1, perPage: 8 });
  assert.equal(estado.totalPaginas, 2);
  assert.equal(estado.tienePaginaSiguiente, true);
  assert.equal(estado.paginaSiguiente, 2);
  assert.equal(estado.tienePaginaAnterior, false);
  assert.equal(estado.paginaAnterior, null);
});

test('la ultima pagina no ofrece siguiente', () => {
  const estado = calcularPaginacion({ total: 10, page: 2, perPage: 8 });
  assert.equal(estado.tienePaginaSiguiente, false);
  assert.equal(estado.paginaSiguiente, null);
  assert.equal(estado.tienePaginaAnterior, true);
  assert.equal(estado.paginaAnterior, 1);
});

test('un catalogo vacio siempre tiene al menos una pagina', () => {
  const estado = calcularPaginacion({ total: 0, page: 1, perPage: 8 });
  assert.equal(estado.totalPaginas, 1);
  assert.equal(estado.tienePaginaSiguiente, false);
});

test('una pagina fuera de rango se recorta a la ultima valida', () => {
  const estado = calcularPaginacion({ total: 10, page: 99, perPage: 8 });
  assert.equal(estado.paginaActual, 2);
});

test('per_page invalido o ausente no revienta el calculo', () => {
  const estado = calcularPaginacion({ total: 10, page: 1, perPage: 0 });
  assert.equal(estado.porPagina, 1);
  assert.equal(estado.totalPaginas, 10);
});

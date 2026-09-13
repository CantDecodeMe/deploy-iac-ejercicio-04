'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveCoverUrl, FALLBACK_COVER_DATA_URI } = require('../src/shared/cover');

test('devuelve la URL de portada cuando viene bien formada', () => {
  assert.equal(resolveCoverUrl('https://x/uploads/a.jpg'), 'https://x/uploads/a.jpg');
});

test('recorta espacios en blanco', () => {
  assert.equal(resolveCoverUrl('  https://x/uploads/a.jpg  '), 'https://x/uploads/a.jpg');
});

test('una portada vacia resuelve a null', () => {
  assert.equal(resolveCoverUrl(''), null);
  assert.equal(resolveCoverUrl('   '), null);
});

test('un valor que no es string resuelve a null', () => {
  assert.equal(resolveCoverUrl(undefined), null);
  assert.equal(resolveCoverUrl(null), null);
});

test('el fallback es un data URI de SVG', () => {
  assert.match(FALLBACK_COVER_DATA_URI, /^data:image\/svg\+xml/);
});

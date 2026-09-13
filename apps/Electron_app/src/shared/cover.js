'use strict';

// Fallback de portada como SVG embebido en un data URI: si la portada real
// no carga (URL vacia, host inalcanzable, 404), la tarjeta nunca queda con
// un icono roto -- se resuelve localmente, sin depender de la red.
const FALLBACK_COVER_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360" viewBox="0 0 240 360">' +
      '<rect width="240" height="360" fill="#e2e8f0"/>' +
      '<rect x="16" y="16" width="208" height="328" fill="none" stroke="#94a3b8" stroke-width="2"/>' +
      '<text x="120" y="188" font-family="sans-serif" font-size="16" fill="#64748b" text-anchor="middle">Sin portada</text>' +
      '</svg>'
  );

function resolveCoverUrl(portada) {
  if (typeof portada !== 'string') return null;
  const recortada = portada.trim();
  return recortada.length > 0 ? recortada : null;
}

module.exports = { resolveCoverUrl, FALLBACK_COVER_DATA_URI };

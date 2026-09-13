'use strict';

// Calculo puro del estado de paginacion a partir de lo que ya devuelve el
// servidor (total/page/per_page en el XML) -- la app nunca pagina en el
// cliente, siempre pide la pagina exacta que necesita.

function calcularPaginacion({ total, page, perPage }) {
  const porPagina = Math.max(1, perPage || 1);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaActual = Math.min(Math.max(1, page || 1), totalPaginas);

  return {
    paginaActual,
    totalPaginas,
    total,
    porPagina,
    tienePaginaAnterior: paginaActual > 1,
    tienePaginaSiguiente: paginaActual < totalPaginas,
    paginaAnterior: paginaActual > 1 ? paginaActual - 1 : null,
    paginaSiguiente: paginaActual < totalPaginas ? paginaActual + 1 : null,
  };
}

module.exports = { calcularPaginacion };

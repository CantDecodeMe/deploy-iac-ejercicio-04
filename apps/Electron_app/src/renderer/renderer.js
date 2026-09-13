'use strict';

const CLAVE_SERVER_URL = 'librosApp.serverUrl';
const CLAVE_ENDPOINT = 'librosApp.endpointPath';
const DEFECTO_SERVER_URL = 'https://libros.maxthecoder.online';
const DEFECTO_ENDPOINT = '/books';
const POR_PAGINA = 8;

const elementos = {
  botonConfig: document.getElementById('boton-config'),
  panelConfig: document.getElementById('panel-config'),
  inputServerUrl: document.getElementById('input-server-url'),
  inputEndpoint: document.getElementById('input-endpoint'),
  botonGuardar: document.getElementById('boton-guardar-config'),
  botonRestablecer: document.getElementById('boton-restablecer-config'),
  bannerError: document.getElementById('banner-error'),
  grid: document.getElementById('grid-libros'),
  botonAnterior: document.getElementById('boton-anterior'),
  botonSiguiente: document.getElementById('boton-siguiente'),
  textoPaginacion: document.getElementById('texto-paginacion'),
};

let paginaActual = 1;

function leerConfig() {
  let serverUrl = DEFECTO_SERVER_URL;
  let endpointPath = DEFECTO_ENDPOINT;
  try {
    serverUrl = window.localStorage.getItem(CLAVE_SERVER_URL) || DEFECTO_SERVER_URL;
    endpointPath = window.localStorage.getItem(CLAVE_ENDPOINT) || DEFECTO_ENDPOINT;
  } catch {
    // localStorage puede fallar en un perfil restringido; se sigue con los
    // valores por defecto en vez de dejar la app sin poder arrancar.
  }
  return { serverUrl, endpointPath };
}

function guardarConfig(config) {
  try {
    window.localStorage.setItem(CLAVE_SERVER_URL, config.serverUrl);
    window.localStorage.setItem(CLAVE_ENDPOINT, config.endpointPath);
  } catch {
    // Sin persistencia disponible, la sesion actual sigue funcionando con
    // los valores en memoria; solo no sobrevive a un reinicio.
  }
}

function mostrarError(mensaje) {
  if (!mensaje) {
    elementos.bannerError.hidden = true;
    elementos.bannerError.textContent = '';
    return;
  }
  elementos.bannerError.hidden = false;
  elementos.bannerError.textContent = mensaje;
}

function crearTarjeta(libro) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta-libro';

  const img = document.createElement('img');
  img.alt = `Portada de ${libro.title || 'libro sin título'}`;
  img.loading = 'lazy';
  img.src = window.librosApp.resolveCoverUrl(libro.portada) || window.librosApp.FALLBACK_COVER_DATA_URI;
  img.addEventListener('error', () => {
    img.src = window.librosApp.FALLBACK_COVER_DATA_URI;
  });

  const cuerpo = document.createElement('div');
  cuerpo.className = 'cuerpo';

  const titulo = document.createElement('h3');
  titulo.textContent = libro.title || 'Sin título';

  const autores = document.createElement('div');
  autores.className = 'autores';
  autores.textContent = libro.authors.length > 0 ? libro.authors.join(', ') : 'Autor desconocido';

  const detalle = document.createElement('div');
  detalle.className = 'detalle';
  detalle.innerHTML = '';
  [
    libro.isbn ? `ISBN ${libro.isbn}` : null,
    libro.year ? `Año ${libro.year}` : null,
    libro.genero || null,
    Number.isFinite(Number(libro.stock)) ? `Stock ${libro.stock}` : null,
  ]
    .filter(Boolean)
    .forEach((texto) => {
      const span = document.createElement('span');
      span.textContent = texto;
      detalle.appendChild(span);
    });

  const precio = document.createElement('div');
  precio.className = 'precio';
  const numero = Number(libro.price);
  precio.textContent = Number.isFinite(numero) ? `$${numero.toFixed(2)}` : libro.price;

  cuerpo.append(titulo, autores, detalle, precio);
  tarjeta.append(img, cuerpo);
  return tarjeta;
}

function renderizarLibros(libros) {
  elementos.grid.innerHTML = '';
  if (libros.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'estado-vacio';
    vacio.textContent = 'No hay libros que mostrar.';
    elementos.grid.appendChild(vacio);
    return;
  }
  for (const libro of libros) {
    elementos.grid.appendChild(crearTarjeta(libro));
  }
}

function actualizarPaginador(estado) {
  elementos.textoPaginacion.textContent = `Página ${estado.paginaActual} de ${estado.totalPaginas} · ${estado.total} libros`;
  elementos.botonAnterior.disabled = !estado.tienePaginaAnterior;
  elementos.botonSiguiente.disabled = !estado.tienePaginaSiguiente;
}

async function cargarPagina(pagina) {
  const config = leerConfig();
  const resultado = await window.librosApp.fetchPage(config, { page: pagina, per_page: POR_PAGINA });

  if (!resultado.ok) {
    mostrarError(`No se pudo cargar el catálogo: ${resultado.error}`);
    renderizarLibros([]);
    return;
  }

  let datos;
  try {
    datos = window.librosApp.parseBooksXml(resultado.xml);
  } catch (error) {
    mostrarError(`Respuesta invalida del servidor: ${error.message}`);
    renderizarLibros([]);
    return;
  }

  mostrarError(null);
  paginaActual = datos.page;
  renderizarLibros(datos.books);
  actualizarPaginador(window.librosApp.calcularPaginacion(datos));
}

function abrirPanelConfig() {
  const config = leerConfig();
  elementos.inputServerUrl.value = config.serverUrl;
  elementos.inputEndpoint.value = config.endpointPath;
  elementos.panelConfig.hidden = !elementos.panelConfig.hidden;
}

elementos.botonConfig.addEventListener('click', abrirPanelConfig);

elementos.botonGuardar.addEventListener('click', () => {
  const serverUrl = elementos.inputServerUrl.value.trim() || DEFECTO_SERVER_URL;
  const endpointPath = elementos.inputEndpoint.value.trim() || DEFECTO_ENDPOINT;
  guardarConfig({ serverUrl, endpointPath });
  elementos.panelConfig.hidden = true;
  cargarPagina(1);
});

elementos.botonRestablecer.addEventListener('click', () => {
  elementos.inputServerUrl.value = DEFECTO_SERVER_URL;
  elementos.inputEndpoint.value = DEFECTO_ENDPOINT;
});

elementos.botonAnterior.addEventListener('click', () => cargarPagina(paginaActual - 1));
elementos.botonSiguiente.addEventListener('click', () => cargarPagina(paginaActual + 1));

cargarPagina(1);

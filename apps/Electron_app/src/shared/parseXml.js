'use strict';

// Parser XML minimalista, sin dependencias, a proposito: el contrato que
// devuelve libros-ms es simple (sin namespaces, sin CDATA, generado con
// xml.etree.ElementTree) y así este modulo se prueba con `node --test`
// puro, sin instalar nada ni depender de un DOMParser de navegador.

// El grupo de atributos solo reconoce pares nombre="valor" (o con comillas
// simples) -- si en vez de eso consumiera "cualquier caracter que no sea
// <>\"'", se tragaria la barra de un self-closing "<year />" antes de que
// el grupo final la vea, y todo el arbol quedaria mal anidado.
const TAG_RE = /<(\/?)([a-zA-Z_][\w:-]*)((?:\s+[a-zA-Z_:][\w:.-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTR_RE = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function desescapar(texto) {
  return texto.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (coincidencia, cuerpo) => {
    if (cuerpo[0] === '#') {
      const codigo = cuerpo[1] === 'x' || cuerpo[1] === 'X'
        ? parseInt(cuerpo.slice(2), 16)
        : parseInt(cuerpo.slice(1), 10);
      return Number.isNaN(codigo) ? coincidencia : String.fromCodePoint(codigo);
    }
    return ENTIDADES[cuerpo] ?? coincidencia;
  });
}

function parsearAtributos(cadena) {
  const atributos = {};
  let coincidencia;
  ATTR_RE.lastIndex = 0;
  while ((coincidencia = ATTR_RE.exec(cadena)) !== null) {
    atributos[coincidencia[1]] = desescapar(coincidencia[2]);
  }
  return atributos;
}

/**
 * Convierte un documento XML en un arbol { tag, attrs, children, text }.
 * `text` es el texto directo del nodo (sin el de los hijos).
 */
function parsearDocumento(xml) {
  const sinDeclaracion = xml.replace(/^\s*<\?xml[^>]*\?>\s*/i, '');
  const raiz = { tag: '#raiz', attrs: {}, children: [], text: '' };
  const pila = [raiz];

  let ultimoIndice = 0;
  let coincidencia;
  TAG_RE.lastIndex = 0;

  while ((coincidencia = TAG_RE.exec(sinDeclaracion)) !== null) {
    const [etiquetaCompleta, cierre, nombre, atributosCrudos, autoCierre] = coincidencia;
    const textoPrevio = sinDeclaracion.slice(ultimoIndice, coincidencia.index);
    if (textoPrevio.trim().length > 0) {
      pila[pila.length - 1].text += desescapar(textoPrevio);
    }
    ultimoIndice = coincidencia.index + etiquetaCompleta.length;

    if (cierre === '/') {
      if (pila.length <= 1 || pila[pila.length - 1].tag !== nombre) {
        throw new Error(`XML mal formado: se esperaba cierre de "${pila[pila.length - 1]?.tag}", vino "${nombre}".`);
      }
      pila.pop();
      continue;
    }

    const nodo = { tag: nombre, attrs: parsearAtributos(atributosCrudos), children: [], text: '' };
    pila[pila.length - 1].children.push(nodo);
    if (autoCierre !== '/') {
      pila.push(nodo);
    }
  }

  if (pila.length !== 1) {
    throw new Error(`XML mal formado: falta cerrar "${pila[pila.length - 1].tag}".`);
  }

  return raiz;
}

function hijo(nodo, tag) {
  return nodo.children.find((hijoNodo) => hijoNodo.tag === tag) || null;
}

function hijos(nodo, tag) {
  return nodo.children.filter((hijoNodo) => hijoNodo.tag === tag);
}

function textoDe(nodo, tag) {
  const encontrado = hijo(nodo, tag);
  return encontrado ? encontrado.text : '';
}

function libroDesdeNodo(nodoBook) {
  const autores = hijo(nodoBook, 'authors');
  const conceptos = hijo(nodoBook, 'concepts');

  return {
    isbn: textoDe(nodoBook, 'isbn'),
    title: textoDe(nodoBook, 'title'),
    genero: textoDe(nodoBook, 'genero'),
    formato: textoDe(nodoBook, 'formato'),
    editorial: textoDe(nodoBook, 'editorial'),
    year: textoDe(nodoBook, 'year'),
    portada: textoDe(nodoBook, 'portada'),
    price: textoDe(nodoBook, 'price'),
    stock: textoDe(nodoBook, 'stock'),
    authors: autores ? hijos(autores, 'author').map((a) => a.text) : [],
    concepts: conceptos
      ? hijos(conceptos, 'concept').map((c) => ({
          termino: textoDe(c, 'termino'),
          definicion: textoDe(c, 'definicion'),
        }))
      : [],
  };
}

/**
 * Parsea la respuesta de GET /books: <books total=".." page=".." per_page="..">.
 */
function parseBooksXml(xml) {
  const raiz = parsearDocumento(xml);
  const nodoBooks = hijo(raiz, 'books');
  if (!nodoBooks) {
    throw new Error('XML invalido: falta el elemento raiz <books>.');
  }

  return {
    total: Number.parseInt(nodoBooks.attrs.total, 10) || 0,
    page: Number.parseInt(nodoBooks.attrs.page, 10) || 1,
    perPage: Number.parseInt(nodoBooks.attrs.per_page, 10) || 0,
    books: hijos(nodoBooks, 'book').map(libroDesdeNodo),
  };
}

/**
 * Parsea la respuesta de GET /books/<isbn>: un solo <book> como raiz.
 */
function parseBookXml(xml) {
  const raiz = parsearDocumento(xml);
  const nodoBook = hijo(raiz, 'book');
  if (!nodoBook) {
    throw new Error('XML invalido: falta el elemento raiz <book>.');
  }
  return libroDesdeNodo(nodoBook);
}

module.exports = { parseBooksXml, parseBookXml };

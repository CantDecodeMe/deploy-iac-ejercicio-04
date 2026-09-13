'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { parseBooksXml } = require('../shared/parseXml');
const { calcularPaginacion } = require('../shared/paginate');
const { resolveCoverUrl, FALLBACK_COVER_DATA_URI } = require('../shared/cover');

// El renderer corre sin nodeIntegration: todo lo que necesita del proceso
// main o de los modulos puros de src/shared se expone aqui, explicito y
// de solo lectura. El renderer nunca hace la peticion de red el mismo.
contextBridge.exposeInMainWorld('librosApp', {
  fetchPage: (config, params) => ipcRenderer.invoke('libros:fetch-page', { ...config, params }),
  parseBooksXml,
  calcularPaginacion,
  resolveCoverUrl,
  FALLBACK_COVER_DATA_URI,
});

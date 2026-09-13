'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

const TIEMPO_LIMITE_MS = 8000;

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // El sandbox de Electron restringe el preload a un require() que
      // solo resuelve modulos nativos de Node, no archivos locales del
      // proyecto (src/shared/*). Se desactiva solo para el preload -- el
      // renderer sigue sin nodeIntegration y sin acceso a Node -- porque
      // esta app solo carga su propio index.html local, nunca contenido
      // remoto ni de terceros.
      sandbox: false,
    },
  });

  ventana.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function construirUrl(serverUrl, endpointPath, params) {
  const base = serverUrl.replace(/\/+$/, '');
  const ruta = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const url = new URL(base + ruta);
  for (const [clave, valor] of Object.entries(params || {})) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(clave, String(valor));
    }
  }
  return url;
}

// El fetch se hace aqui, en el proceso main, no en el renderer: asi se
// evita CORS (el renderer nunca hace la peticion de red directamente) y
// el renderer no necesita permiso de red propio.
ipcMain.handle('libros:fetch-page', async (_evento, { serverUrl, endpointPath, params }) => {
  let url;
  try {
    url = construirUrl(serverUrl, endpointPath, params);
  } catch {
    return { ok: false, error: `URL invalida: "${serverUrl}${endpointPath}".` };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Solo se permiten URLs http:// o https://.' };
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_MS);

  try {
    const respuesta = await fetch(url, { signal: controlador.signal });
    const cuerpo = await respuesta.text();
    if (!respuesta.ok) {
      return { ok: false, error: `El servidor respondio ${respuesta.status}.` };
    }
    return { ok: true, xml: cuerpo };
  } catch (error) {
    const motivo = error.name === 'AbortError' ? 'Tiempo de espera agotado.' : error.message;
    return { ok: false, error: motivo };
  } finally {
    clearTimeout(temporizador);
  }
});

app.whenReady().then(() => {
  crearVentana();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

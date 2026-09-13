# Cliente de escritorio · libros-ms

Aplicación Electron que muestra el catálogo de la librería en cards (portada,
autor(es), ISBN, stock, año, género y precio), con paginación y carga por
petición. Consume exclusivamente el XML de un microservicio REST — por
defecto `https://libros.maxthecoder.online/books` — pero la URL y el
endpoint son configurables desde la propia aplicación y se guardan en
`localStorage`.

## Ejecutar en Windows 11

1. Descarga el instalador desde `https://libros.maxthecoder.online/download-client`
   (botón **Descargar para Windows**), o pide el archivo
   `libros-ms-client-win32-x64.zip`.
2. Descomprime el `.zip` en cualquier carpeta (clic derecho → *Extraer todo…*).
3. Entra a la carpeta descomprimida y ejecuta `libros-ms-client.exe`.
   - Si Windows SmartScreen muestra una advertencia (el ejecutable no está
     firmado), elige **Más información → Ejecutar de todas formas**.
4. Al abrir, la app carga el catálogo desde el servidor por defecto. Para
   apuntar a otro servidor: botón **Configuración** (arriba a la derecha),
   edita **URL del servidor** y **Endpoint**, y presiona **Guardar y
   recargar**. La configuración persiste entre sesiones.

No hace falta instalar Node.js, Electron ni ninguna otra dependencia: el
`.zip` ya incluye el runtime completo.

## Ejecutar en Linux

1. Descarga `libros-ms-client-linux-x64.zip` desde el mismo `/download-client`.
2. Descomprime y ejecuta `./run.sh` dentro de la carpeta.

## Desarrollo

Este proyecto no usa un `npm` global — en el Pi donde se desarrolló no hay
uno instalado, así que se vendorizó en `../../tools/npm/` (ver el README
del repo raíz). Desde `apps/Electron_app/`:

```bash
node ../../tools/npm/bin/npm-cli.js install     # una sola vez
node ../../tools/npm/bin/npm-cli.js run check:env
node ../../tools/npm/bin/npm-cli.js test         # 17 casos, node --test puro
node ../../tools/npm/bin/npm-cli.js start        # corre la app en modo desarrollo
```

Si tu máquina sí tiene `npm` en el PATH, cualquiera de esos comandos
funciona igual con `npm` en vez de `node ../../tools/npm/bin/npm-cli.js`.

## Estructura

```text
src/
  main/main.js         # crea la ventana; el único que hace fetch() (vía IPC)
  preload/preload.js   # expone fetch + los módulos puros al renderer
  renderer/             # HTML/CSS/JS de la interfaz (cards, paginación, config)
  shared/               # módulos puros: parseXml.js, paginate.js, cover.js
test/                   # node --test sobre src/shared/
scripts/check-env.js    # verifica Node, dependencias y archivos antes de correr/empaquetar
```

## Decisiones de ingeniería

**El fetch corre en el proceso main, no en el renderer.** Evita CORS del
lado del servidor y evita que la página tenga acceso directo a la red. El
renderer solo recibe texto XML ya descargado, vía `ipcRenderer.invoke`.

**El preload corre sin `sandbox`, pero el renderer sigue sin
`nodeIntegration`.** El sandbox de Electron restringe el `require()` del
preload a módulos nativos de Node — no puede resolver archivos locales del
proyecto como `src/shared/parseXml.js`. Como esta app solo carga su propio
`index.html` (nunca contenido remoto ni de terceros), desactivar el sandbox
únicamente para el preload es un trade-off razonable, no una debilidad de
seguridad real para este caso de uso.

**Parser XML propio, sin dependencias.** El contrato de `libros-ms` es
simple (sin namespaces, sin CDATA). Un parser mínimo en
`src/shared/parseXml.js` evita traer una librería completa para un caso de
uso acotado, y permite que los módulos puros se prueben con `node --test`
sin instalar nada.

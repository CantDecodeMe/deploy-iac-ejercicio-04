#!/usr/bin/env node
'use strict';

// Verificacion rapida antes de correr o empaquetar la app: falla con un
// mensaje claro en vez de dejar que `electron .` o electron-packager
// truenen con un error críptico si falta algo.

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
let errores = 0;

function chequeo(descripcion, condicion, ayuda) {
  if (condicion) {
    console.log(`  OK  ${descripcion}`);
  } else {
    console.error(`FALTA  ${descripcion}`);
    if (ayuda) console.error(`       ${ayuda}`);
    errores += 1;
  }
}

const [mayor] = process.versions.node.split('.').map(Number);
chequeo(
  `Node.js >= 18 (actual: ${process.versions.node})`,
  mayor >= 18,
  'La app usa fetch/AbortController globales del proceso main; necesita Node 18+.'
);

const nodeModules = path.join(RAIZ, 'node_modules');
chequeo(
  'node_modules/ instalado',
  fs.existsSync(nodeModules),
  'Corre: node ../../tools/npm/bin/npm-cli.js install'
);

for (const paquete of ['electron', 'electron-packager']) {
  chequeo(
    `dependencia "${paquete}" instalada`,
    fs.existsSync(path.join(nodeModules, paquete)),
    `Corre: node ../../tools/npm/bin/npm-cli.js install`
  );
}

for (const archivo of ['src/main/main.js', 'src/preload/preload.js', 'src/renderer/index.html']) {
  chequeo(`existe ${archivo}`, fs.existsSync(path.join(RAIZ, archivo)));
}

if (errores > 0) {
  console.error(`\n${errores} verificacion(es) fallida(s).`);
  process.exit(1);
}

console.log('\nEntorno listo.');

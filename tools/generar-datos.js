/**
 * Genera src/js/data/{characters,actions}.js a partir de las transcripciones
 * en *-source.json. Los JSON son la fuente de verdad: no edites los .js
 * generados a mano, se sobrescriben.
 *
 *   npm run datos
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SRC = path.join(RAIZ, 'src');
const DATA = path.join(SRC, 'js', 'data');
const CARTAS = path.join(SRC, 'assets', 'cartas');

const leer = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

const personajes = leer('characters-source.json').personajes;
const acciones = leer('actions-source.json').acciones;
const manifiesto = JSON.parse(
  fs.readFileSync(path.join(CARTAS, 'manifiesto.json'), 'utf8')
);

// "O-Finta2.png" -> "o-finta2.jpg"
const imagenDe = manifiesto.reduce((acc, m) => {
  acc[m.original] = m.imagen;
  return acc;
}, {});

const AVISO =
  '/**\n' +
  ' * ARCHIVO GENERADO — no editar a mano.\n' +
  ' * Fuente: src/js/data/*-source.json  ·  Regenerar: npm run datos\n' +
  ' */\n';

/* ----------------------------- Personajes ----------------------------- */

const ORDEN_RAZA = ['desterrado', 'lunaria', 'oxitron', 'reanimado', 'mercenario'];

const persOrdenados = personajes.slice().sort((a, b) => {
  const r = ORDEN_RAZA.indexOf(a.raza) - ORDEN_RAZA.indexOf(b.raza);
  return r !== 0 ? r : a.coste - b.coste || a.nombre.localeCompare(b.nombre);
});

const faltantes = [];

const lineaPersonaje = (p) => {
  if (!fs.existsSync(path.join(CARTAS, p.imagen))) faltantes.push(p.imagen);
  // `imagenFlotante` es opcional: solo la tienen los personajes con arte
  // recortado para la mesa. Va como ruta completa desde src/, no como el
  // nombre suelto de `imagen`.
  if (p.imagenFlotante && !fs.existsSync(path.join(SRC, p.imagenFlotante))) {
    faltantes.push(p.imagenFlotante);
  }
  return (
    '  {\n' +
    `    id: ${JSON.stringify(p.id)},\n` +
    `    nombre: ${JSON.stringify(p.nombre)},\n` +
    `    raza: ${JSON.stringify(p.raza)},\n` +
    `    coste: ${p.coste},\n` +
    `    ataque: ${p.ataque},\n` +
    `    defensa: ${p.defensa},\n` +
    `    timing: ${JSON.stringify(p.timing)},\n` +
    `    texto: ${JSON.stringify(p.texto)},\n` +
    `    cita: ${JSON.stringify(p.cita)},\n` +
    `    imagen: ${JSON.stringify('assets/cartas/' + p.imagen)},\n` +
    (p.imagenFlotante
      ? `    imagenFlotante: ${JSON.stringify(p.imagenFlotante)},\n`
      : '') +
    `    mecanicas: ${JSON.stringify(p.mecanicas)}\n` +
    '  }'
  );
};

const jsPersonajes =
  AVISO +
  'window.Game = window.Game || {};\n\n' +
  'window.Game.CHARACTERS = [\n' +
  persOrdenados.map(lineaPersonaje).join(',\n') +
  '\n];\n\n' +
  'window.Game.CHARACTERS_BY_ID = window.Game.CHARACTERS.reduce((a, c) => {\n' +
  '  a[c.id] = c;\n  return a;\n}, {});\n\n' +
  '/** Personajes elegibles por una raza: los suyos más los mercenarios. */\n' +
  'window.Game.personajesDeRaza = function (razaId) {\n' +
  '  return window.Game.CHARACTERS.filter(\n' +
  "    (c) => c.raza === razaId || c.raza === 'mercenario'\n" +
  '  );\n};\n';

/* ------------------------------ Acciones ------------------------------ */

const ORDEN_TIPO = ['ofensiva', 'defensiva', 'neutral'];

const accOrdenadas = acciones.slice().sort((a, b) => {
  const t = ORDEN_TIPO.indexOf(a.tipo) - ORDEN_TIPO.indexOf(b.tipo);
  return t !== 0 ? t : a.nombre.localeCompare(b.nombre);
});

const lineaAccion = (a) => {
  const img = imagenDe[a.archivo];
  if (!img) faltantes.push(a.archivo + ' (sin entrada en el manifiesto)');
  else if (!fs.existsSync(path.join(CARTAS, img))) faltantes.push(img);
  return (
    '  {\n' +
    `    id: ${JSON.stringify(a.id)},\n` +
    `    nombre: ${JSON.stringify(a.nombre)},\n` +
    `    tipo: ${JSON.stringify(a.tipo)},\n` +
    `    timing: ${JSON.stringify(a.timing)},\n` +
    `    texto: ${JSON.stringify(a.texto)},\n` +
    `    imagen: ${JSON.stringify('assets/cartas/' + (img || ''))},\n` +
    (a.razaRequerida ? `    razaRequerida: ${JSON.stringify(a.razaRequerida)},\n` : '') +
    `    mecanicas: ${JSON.stringify(a.mecanicas)}\n` +
    '  }'
  );
};

const jsAcciones =
  AVISO +
  'window.Game = window.Game || {};\n\n' +
  'window.Game.ACTIONS = [\n' +
  accOrdenadas.map(lineaAccion).join(',\n') +
  '\n];\n\n' +
  'window.Game.ACTIONS_BY_ID = window.Game.ACTIONS.reduce((a, c) => {\n' +
  '  a[c.id] = c;\n  return a;\n}, {});\n\n' +
  "window.Game.TIPOS_ACCION = ['ofensiva', 'defensiva', 'neutral'];\n";

/* ------------------------------ Escritura ----------------------------- */

fs.writeFileSync(path.join(DATA, 'characters.js'), jsPersonajes, 'utf8');
fs.writeFileSync(path.join(DATA, 'actions.js'), jsAcciones, 'utf8');

console.log('characters.js:', persOrdenados.length, 'personajes');
console.log('actions.js   :', accOrdenadas.length, 'acciones');
if (faltantes.length) {
  console.error('IMAGENES QUE FALTAN:', faltantes);
  process.exit(1);
}
console.log('todas las imagenes referenciadas existen');

/**
 * Corre todas las baterías de efectos de carta (tools/pruebas/*.js) y dice
 * si algo se rompió. Cada batería carga el motor en Node, sin pantalla, y
 * comprueba casos con el dado fijado.
 *
 *   node tools/probar-efectos.js          # resumen
 *   node tools/probar-efectos.js --todo   # cada caso
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'pruebas');
const todo = process.argv.includes('--todo');
let fallos = 0;
let casos = 0;

for (const archivo of fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).sort()) {
  let salida = '';
  try {
    salida = execFileSync(process.execPath, [path.join(DIR, archivo)], { encoding: 'utf8' });
  } catch (err) {
    salida = `${err.stdout || ''}\nMAL  la batería revienta: ${err.message.split('\n')[0]}`;
  }
  const lineas = salida.split('\n').filter((l) => /^(OK |MAL)/.test(l));
  const malas = lineas.filter((l) => l.startsWith('MAL'));
  casos += lineas.length;
  fallos += malas.length;
  console.log(`${malas.length ? '✗' : '✓'} ${archivo.replace('.js', '')}: ${lineas.length - malas.length}/${lineas.length}`);
  for (const l of todo ? lineas : malas) console.log(`    ${l}`);
}
console.log(fallos ? `\n${fallos} de ${casos} casos fallan.` : `\nLos ${casos} casos pasan.`);
process.exit(fallos ? 1 : 0);

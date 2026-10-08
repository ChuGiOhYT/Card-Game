/**
 * Genera MAPA.md: el índice de dónde vive cada cosa del proyecto.
 *
 * Se deriva del código, no se escribe a mano, para que no envejezca:
 *
 *   npm run mapa
 *
 * Lee los .js de src/ y extrae módulos, funciones y métodos con su línea.
 * Lo que no se puede deducir del código (convenciones, decisiones, trampas)
 * va en CLAUDE.md, que sí es manual.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SRC = path.join(RAIZ, 'src');

/** Recorre src/ y devuelve las rutas .js en orden de carga de index.html. */
function archivosEnOrden() {
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const orden = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

  const todos = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.js')) {
        todos.push(path.relative(SRC, p).replace(/\\/g, '/'));
      }
    }
  };
  recorrer(path.join(SRC, 'js'));

  // Primero los que carga index.html, en su orden; luego cualquier huérfano.
  const ordenados = orden.filter((o) => todos.includes(o));
  const huerfanos = todos.filter((t) => !orden.includes(t));
  return { ordenados, huerfanos };
}

/**
 * Extrae la superficie pública de un archivo: qué cuelga de window.Game y
 * qué funciones/métodos define, con su línea.
 */
function analizar(rutaRel) {
  const texto = fs.readFileSync(path.join(SRC, rutaRel), 'utf8');
  const lineas = texto.split('\n');

  const exporta = [];
  const funciones = [];
  let claseActual = null;
  let objetoActual = null;

  lineas.forEach((linea, i) => {
    const n = i + 1;
    const sinComentar = linea.replace(/\/\/.*$/, '');

    // window.Game.LO_QUE_SEA = ...
    const asignacion = sinComentar.match(/^window\.Game\.([A-Za-z_$][\w$]*)\s*=/);
    if (asignacion) {
      const nombre = asignacion[1];
      const esFuncion = /=\s*function/.test(sinComentar);
      const esClase = /=\s*class/.test(sinComentar);
      const esObjeto = /=\s*\{\s*$/.test(sinComentar);
      exporta.push({
        nombre,
        linea: n,
        tipo: esClase ? 'clase' : esFuncion ? 'función' : esObjeto ? 'módulo' : 'dato'
      });
      claseActual = esClase ? nombre : null;
      objetoActual = esObjeto ? nombre : null;
      if (esFuncion) {
        funciones.push({ nombre: `${nombre}()`, linea: n, contexto: null });
      }
      return;
    }

    // Métodos de objeto o de clase, con dos espacios de sangría.
    const metodo = sinComentar.match(
      /^ {2}(?:(?:async|static|get|set)\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/
    );
    if (metodo && (claseActual || objetoActual)) {
      const [, nombre, args] = metodo;
      if (nombre === 'if' || nombre === 'for' || nombre === 'while') return;
      funciones.push({
        nombre: `${nombre}(${args.trim() ? '…' : ''})`,
        linea: n,
        contexto: claseActual || objetoActual
      });
    }
  });

  // Datos: cuántos registros define (para los archivos de contenido).
  const registros = [];
  const arrays = [...texto.matchAll(/window\.Game\.([A-Z_]+)\s*=\s*\[/g)];
  for (const a of arrays) {
    const desde = texto.indexOf(a[0]);
    const trozo = texto.slice(desde);
    const cuenta = (trozo.slice(0, trozo.indexOf('\n];')).match(/^ {2}\{/gm) || []).length;
    if (cuenta) registros.push(`${a[1]}: ${cuenta}`);
  }

  return { exporta, funciones, registros, lineas: lineas.length };
}

const GRUPOS = [
  ['js/data/', 'Datos', 'Contenido del juego. Los `-source.json` mandan sobre los `.js` generados.'],
  ['js/core/', 'Núcleo', 'Reglas y estado. No tocan el DOM.'],
  ['js/screens/', 'Pantallas', 'Una por archivo. Reciben `(contenedor, params)` y pintan.'],
  ['js/', 'Arranque', '']
];

const { ordenados, huerfanos } = archivosEnOrden();
const todos = [...ordenados, ...huerfanos];

let md = `# Mapa del proyecto

> **Archivo generado.** No lo edites a mano: se regenera con \`npm run mapa\`.
> Las convenciones y las trampas conocidas están en [CLAUDE.md](CLAUDE.md).

Generado desde \`src/index.html\` siguiendo el orden real de carga de los
scripts, que también es el orden de dependencias.

`;

// Índice rápido de la API pública, que es lo que más se busca.
const apiGlobal = [];
for (const f of todos) {
  const a = analizar(f);
  for (const e of a.exporta) apiGlobal.push({ ...e, archivo: f });
}

md += `## Índice rápido de \`window.Game\`\n\n`;
md += `| Símbolo | Tipo | Archivo:línea |\n|---|---|---|\n`;
for (const e of apiGlobal.sort((x, y) => x.nombre.localeCompare(y.nombre))) {
  md += `| \`Game.${e.nombre}\` | ${e.tipo} | \`src/${e.archivo}:${e.linea}\` |\n`;
}
md += `\n`;

for (const [prefijo, titulo, nota] of GRUPOS) {
  const delGrupo = todos.filter(
    (f) =>
      f.startsWith(prefijo) &&
      !GRUPOS.some(([p]) => p !== prefijo && p.length > prefijo.length && f.startsWith(p))
  );
  if (!delGrupo.length) continue;

  md += `## ${titulo}\n\n`;
  if (nota) md += `${nota}\n\n`;

  for (const f of delGrupo) {
    const a = analizar(f);
    md += `### \`src/${f}\`  ·  ${a.lineas} líneas\n\n`;

    if (a.exporta.length) {
      md += `Expone: ${a.exporta.map((e) => `\`Game.${e.nombre}\``).join(', ')}\n\n`;
    }
    if (a.registros.length) {
      md += `Registros: ${a.registros.join(' · ')}\n\n`;
    }
    if (a.funciones.length) {
      md += `| Función | Línea |\n|---|---|\n`;
      for (const fn of a.funciones) {
        const etq = fn.contexto ? `${fn.contexto}.${fn.nombre}` : fn.nombre;
        md += `| \`${etq}\` | ${fn.linea} |\n`;
      }
      md += `\n`;
    }
  }
}

if (huerfanos.length) {
  md += `## Sin cargar en index.html\n\n`;
  md += huerfanos.map((h) => `- \`src/${h}\``).join('\n') + '\n\n';
}

md += `---\n\nRegenerado: \`npm run mapa\`\n`;

fs.writeFileSync(path.join(RAIZ, 'MAPA.md'), md, 'utf8');

const totalFn = todos.reduce((s, f) => s + analizar(f).funciones.length, 0);
console.log('MAPA.md generado');
console.log('  archivos:', todos.length, '(' + huerfanos.length, 'sin cargar en index.html)');
console.log('  símbolos en window.Game:', apiGlobal.length);
console.log('  funciones indexadas:', totalFn);

/**
 * Las cuatro razas jugables más los mercenarios.
 *
 * La sangre (30) y su ritmo de derrame son iguales para todos. Lo que
 * distingue a una raza es su plantilla y el tipo de efecto que reparte,
 * descrito aquí a partir de lo que hacen sus cartas reales.
 *
 * Los mercenarios no son una raza seleccionable: acompañan a cualquier equipo,
 * por eso están en RACES pero no en RACE_ORDER.
 */
window.Game = window.Game || {};

window.Game.RACES = {
  lunaria: {
    id: 'lunaria',
    nombre: 'Lunaria',
    lema: 'La marea recuerda lo que la piedra olvida',
    sigil: '☾',
    emblema: 'assets/emblemas/lunaria.webp',
    colorPrimario: '#7ec8f2',
    colorSecundario: '#2a4a7a',
    // Ambiente de su campaña: se pinta a tamaño de ventana y con los bordes
    // difuminados detrás de la selección de estirpe, del calabozo y de sus
    // partidas de historia. Es opcional: la raza que no lo tenga no lo pinta.
    fondo: 'assets/fondos/lunaria.jpg',
    // Y en bucle, si la estirpe lo tiene. La imagen de arriba sigue haciendo
    // falta: es el `poster` mientras carga el primer fotograma. Ver
    // `ui/ambiente.js` para por qué es MP4 y no GIF.
    fondoVideo: 'assets/video/lunaria.mp4',
    descripcion:
      'Herederas del ciclo lunar. Crecen conforme sus propios aliados quedan ' +
      'revelados, y su reina bloquea acciones enemigas. Premian que enseñes ' +
      'tus cartas en vez de esconderlas.',
    afinidad: ['sinergia', 'bloqueo'],
    dificultad: 2
  },

  desterrado: {
    id: 'desterrado',
    nombre: 'Desterrado',
    lema: 'Sin tierra, sin nombre, sin freno',
    sigil: '⚔',
    emblema: 'assets/emblemas/desterrado.webp',
    colorPrimario: '#f0913a',
    colorSecundario: '#7a3a1a',
    // Ambiente de su campaña: se pinta a tamaño de ventana y con los bordes
    // difuminados detrás de la selección de estirpe, del calabozo y de sus
    // partidas de historia. Es opcional: la raza que no lo tenga no lo pinta.
    fondo: 'assets/fondos/desterrado.jpg',
    // Y en bucle, si la estirpe lo tiene. La imagen de arriba sigue haciendo
    // falta: es el `poster` mientras carga el primer fotograma. Ver
    // `ui/ambiente.js` para por qué es MP4 y no el GIF de origen.
    fondoVideo: 'assets/video/desterrado.mp4',
    descripcion:
      'Expulsados de todo reino conocido. Viven de la información: casi todos ' +
      'eligen entre revelar cartas del rival o pegar más fuerte, y escalan con ' +
      'lo que ya está descubierto.',
    afinidad: ['información', 'agresivo'],
    dificultad: 1
  },

  oxitron: {
    id: 'oxitron',
    nombre: 'Oxitrón',
    lema: 'El óxido también es una forma de memoria',
    sigil: '⚙',
    emblema: 'assets/emblemas/oxitron.webp',
    colorPrimario: '#5fd9a8',
    colorSecundario: '#1f5c48',
    // Ambiente de su campaña, igual que las otras. Ver `ui/ambiente.js`.
    fondo: 'assets/fondos/oxitron.jpg',
    fondoVideo: 'assets/video/oxitron.mp4',
    descripcion:
      'Máquinas que sobrevivieron a sus constructores. Defensas altas y control ' +
      'por bloqueo: inmovilizan acciones y personajes rivales. Casi todo lo ' +
      'suyo pasa por una tirada de dado.',
    afinidad: ['defensivo', 'azar'],
    dificultad: 3
  },

  reanimado: {
    id: 'reanimado',
    nombre: 'Reanimado',
    lema: 'Morir es solo cambiar de turno',
    sigil: '◉',
    emblema: 'assets/emblemas/reanimado.webp',
    colorPrimario: '#c07ae8',
    colorSecundario: '#4a2060',
    // Ambiente de su campaña, igual que las otras. Ver `ui/ambiente.js`.
    fondo: 'assets/fondos/reanimado.jpg',
    fondoVideo: 'assets/video/reanimado.mp4',
    descripcion:
      'Lo que cae de su lado nunca se pierde del todo. La única raza sin carta ' +
      'de coste 10: a cambio es la más barata y usa el Hades como motor, ' +
      'ganando fuerza por cada muerto propio.',
    afinidad: ['recursos', 'desgaste'],
    dificultad: 3
  },

  mercenario: {
    id: 'mercenario',
    nombre: 'Mercenario',
    lema: 'La lealtad se cobra por adelantado',
    sigil: '?',
    emblema: 'assets/emblemas/mercenario.webp',
    colorPrimario: '#d8d2c4',
    colorSecundario: '#4a463c',
    descripcion:
      'Sin bando. Los cuatro comparten coste 5 y estadísticas 4/4, y pueden ' +
      'entrar en el equipo de cualquier raza.',
    afinidad: ['neutral'],
    dificultad: 2,
    seleccionable: false
  }
};

/**
 * Razas jugables, en el orden en que se recorre la campaña. Cada calabozo
 * se abre al terminar el anterior, así que este orden manda: no es solo el
 * orden en que se pintan las tarjetas.
 */
window.Game.RACE_ORDER = ['desterrado', 'lunaria', 'oxitron', 'reanimado'];

/**
 * El emblema de una estirpe (o de los mercenarios) como imagen, con su sombra
 * (CSS `.emblema`). Acepta el id o el objeto de la raza; lo que no tiene
 * emblema (las criaturas del calabozo) cae a su `sigil` de texto. `tam` en px
 * o cualquier medida CSS; sin él, 1.25em (crece con la letra de donde se
 * ponga, como hacía el símbolo) o lo que diga el CSS de ese sitio.
 */
window.Game.emblema = function (raza, tam = null) {
  const r = typeof raza === 'string' ? window.Game.RACES[raza] : raza;
  if (!r) return '';
  if (!r.emblema) return r.sigil || '';
  // Sin `tam`, el tamaño lo pone el CSS de cada sitio (en línea lo pisaría).
  const estilo = [tam !== null ? `--tam:${typeof tam === 'number' ? `${tam}px` : tam}` : '',
    r.colorPrimario ? `--raza-primario:${r.colorPrimario}` : ''].filter(Boolean).join(';');
  return `<img class="emblema" src="${r.emblema}" alt="${r.nombre || ''}" draggable="false" style="${estilo}">`;
};

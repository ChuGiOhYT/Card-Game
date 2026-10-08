/**
 * Criaturas de calabozo, transcritas de sus cartas.
 *
 * No entran en `CHARACTERS` a propósito: esa lista alimenta el constructor de
 * equipos y las estadísticas por raza, y las criaturas no son reclutables.
 * Sí se registran en `CHARACTERS_BY_ID`, que es de donde el combate lee
 * ataque, defensa y nombre.
 *
 * No tienen coste: el calabozo las despliega sin pagar sangre.
 */
window.Game = window.Game || {};

window.Game.CREATURES = [
  /* ------------------- Calabozo del bosque nocturno -------------------- */
  {
    id: 'cri_ratas',
    nombre: 'Ratas corruptas',
    raza: 'criatura',
    coste: 0,
    ataque: 4,
    defensa: 4,
    imagen: 'assets/cartas/calabozo3a.jpg'
  },
  {
    id: 'cri_lobo',
    nombre: 'Lobo corrupto',
    raza: 'criatura',
    coste: 0,
    ataque: 5,
    defensa: 5,
    imagen: 'assets/cartas/calabozo3b.jpg'
  },
  {
    id: 'cri_gnolls',
    nombre: 'Gnolls corruptos',
    raza: 'criatura',
    coste: 0,
    ataque: 6,
    defensa: 6,
    imagen: 'assets/cartas/calabozo3c.jpg'
  },
  {
    id: 'cri_conspiradores',
    nombre: 'Conspiradores',
    raza: 'criatura',
    coste: 0,
    ataque: 7,
    defensa: 7,
    imagen: 'assets/cartas/calabozo3d.jpg'
  },
  {
    id: 'cri_esbirro_bosque',
    // Cubre a su Eternal: mientras siga en pie, no se le puede atacar.
    esEsbirro: true,
    nombre: 'Esbirro del bosque nocturno',
    raza: 'criatura',
    coste: 0,
    ataque: 4,
    defensa: 4,
    imagen: 'assets/cartas/esbirro-del-bosque-nocturno.jpg'
  },
  {
    id: 'cri_uldar',
    nombre: 'Üldar, eternal del bosque nocturno',
    raza: 'eternal',
    coste: 0,
    ataque: 10,
    defensa: 8,
    imagen: 'assets/cartas/eternal-del-bosque-nocturno.jpg',
    imagenFlotante: 'assets/personajes-flotantes/cri_uldar-flotante.png',
    // Las cuatro habilidades impresas. Las ejecuta `core/bossAbilities.js`,
    // que cada turno del jefe lanza UNA al azar.
    habilidades: [
      {
        n: 1,
        nombre: 'Convocar',
        texto:
          'Convoca un esbirro del oasis de coste 3 por cada personaje activo. ' +
          'Si hay un esbirro en campo, no puedes atacar al eternal.',
        _aviso: 'La carta dice «del oasis»; en este calabozo el esbirro es el del bosque nocturno.'
      },
      { n: 2, nombre: 'Revelar', texto: 'Revela todos los personajes de los oponentes.' },
      {
        n: 3,
        nombre: 'Tenebres',
        texto:
          'Infringe un ataque de 10 al grupo +1 por cada dos cartas reveladas. ' +
          'El daño se distribuye entre todos los personajes activos; si no lo hay, ' +
          'infringe daño directo a la pila de sangres.'
      },
      { n: 4, nombre: 'Ocultar', texto: 'Oculta las acciones de los personajes oponentes.' }
    ]
  },

  /* ----------------------- Calabozo de las catacumbas ------------------- */
  {
    id: 'cri_condenados',
    nombre: 'Los contenados',
    _avisoNombre: 'La carta dice «contenados»; parece una errata de «condenados».',
    raza: 'criatura',
    coste: 0,
    ataque: 4,
    defensa: 4,
    imagen: 'assets/cartas/calabozo1a.jpg'
  },
  {
    id: 'cri_slime',
    nombre: 'Slime corrupto',
    raza: 'criatura',
    coste: 0,
    ataque: 6,
    defensa: 6,
    imagen: 'assets/cartas/calabozo1b.jpg'
  },
  {
    id: 'cri_nigromante',
    nombre: 'Nigromante',
    raza: 'criatura',
    coste: 0,
    ataque: 7,
    defensa: 7,
    imagen: 'assets/cartas/calabozo1c.jpg'
  },
  {
    id: 'cri_esbirro_catacumbas',
    // Cubre a su Eternal: mientras siga en pie, no se le puede atacar.
    esEsbirro: true,
    nombre: 'Esbirro de las catacumbas',
    raza: 'criatura',
    coste: 0,
    ataque: 4,
    defensa: 4,
    imagen: 'assets/cartas/esbirro-de-las-catacumbas.jpg'
  },
  {
    id: 'cri_tarh_akh',
    nombre: 'Tarh Akh, eternal de las catacumbas',
    raza: 'eternal',
    coste: 0,
    ataque: 10,
    defensa: 8,
    imagen: 'assets/cartas/eternal-de-las-catacumbas.jpg',
    imagenFlotante: 'assets/personajes-flotantes/cri_tarh_akh-flotante.png',
    habilidades: [
      {
        n: 1,
        nombre: 'Convocar',
        texto:
          'Convoca un esbirro de las catacumbas de coste 3 por cada personaje ' +
          'activo. Si hay un esbirro en campo, no puedes atacar al eternal.'
      },
      {
        n: 2,
        nombre: 'Burlar',
        texto: 'Intercambia el ataque y defensa de todos los personajes oponentes.'
      },
      {
        n: 3,
        nombre: 'Purgatorio',
        texto:
          'Infringe un ataque de 10 al grupo +1 por cada personaje en el hades. ' +
          'El daño se distribuye entre todos los personajes activos; si no lo hay, ' +
          'infringe daño directo a la pila de sangres.'
      },
      {
        n: 4,
        nombre: 'Adaptación',
        texto:
          'Quita la acción equipada a los personajes oponentes; la acción queda ' +
          'inutilizable por una serie.'
      }
    ]
  },

  /* -------------------------- Calabozo del oasis ------------------------ */
  {
    id: 'cri_centauro',
    nombre: 'Centauro corrupto',
    raza: 'criatura',
    coste: 0,
    ataque: 6,
    defensa: 6,
    imagen: 'assets/cartas/calabozo2a.jpg'
  },
  {
    id: 'cri_troles',
    nombre: 'Troles corruptos',
    raza: 'criatura',
    coste: 0,
    ataque: 7,
    defensa: 7,
    imagen: 'assets/cartas/calabozo2b.jpg'
  },
  {
    id: 'cri_culto_eclipse',
    nombre: 'El culto del eclipse',
    raza: 'criatura',
    coste: 0,
    ataque: 8,
    defensa: 8,
    imagen: 'assets/cartas/calabozo2c.jpg'
  },
  {
    id: 'cri_esbirro_oasis',
    // Cubre a su Eternal: mientras siga en pie, no se le puede atacar.
    esEsbirro: true,
    nombre: 'Esbirro del oasis',
    raza: 'criatura',
    coste: 0,
    ataque: 4,
    defensa: 4,
    imagen: 'assets/cartas/esbirro-del-oasis.jpg'
  },
  {
    id: 'cri_brahma',
    nombre: 'Brahma, eternal de los oasis',
    raza: 'eternal',
    coste: 0,
    ataque: 10,
    defensa: 8,
    imagen: 'assets/cartas/eternal-de-los-oasis.jpg',
    imagenFlotante: 'assets/personajes-flotantes/cri_brahma-flotante.png',
    habilidades: [
      {
        n: 1,
        nombre: 'Convocar',
        texto:
          'Convoca un esbirro del oasis de coste 3 por cada personaje activo. ' +
          'Si hay un esbirro en campo, no puedes atacar al eternal.'
      },
      {
        n: 2,
        nombre: 'Aplacar',
        texto: 'Derrama dos sangres de la pila de todos los jugadores.'
      },
      {
        n: 3,
        nombre: 'Luminaria',
        texto:
          'Infringe un ataque de 10 al grupo + cantidad de personajes activos x1. ' +
          'El daño se distribuye entre todos los personajes activos; si no lo hay, ' +
          'infringe daño directo a la pila de sangres.'
      },
      {
        n: 4,
        nombre: 'Cegar',
        texto:
          'Todos los personajes del grupo quedan aturdidos: no pueden cambiarse ' +
          'ni cambiar su acción.'
      }
    ]
  },

  /* ------------------------- Calabozo de las forjas --------------------- */
  {
    id: 'cri_rocoso',
    nombre: 'Rocoso corrupto',
    raza: 'criatura',
    coste: 0,
    ataque: 4,
    defensa: 4,
    imagen: 'assets/cartas/calabozo4a.jpg'
  },
  {
    id: 'cri_guardian',
    nombre: 'Guardián corrupto',
    raza: 'criatura',
    coste: 0,
    ataque: 7,
    defensa: 7,
    imagen: 'assets/cartas/calabozo4b.jpg'
  },
  {
    id: 'cri_horda',
    nombre: 'Horda llameante',
    raza: 'criatura',
    coste: 0,
    ataque: 8,
    defensa: 8,
    imagen: 'assets/cartas/calabozo4c.jpg'
  },
  {
    id: 'cri_esbirro_forjas',
    // Cubre a su Eternal: mientras siga en pie, no se le puede atacar.
    esEsbirro: true,
    nombre: 'Esbirro de las forjas',
    raza: 'criatura',
    coste: 0,
    ataque: 4,
    defensa: 4,
    imagen: 'assets/cartas/esbirro-de-las-forjas.jpg'
  },
  {
    id: 'cri_atar',
    nombre: "A'tar, eternal de las forjas",
    raza: 'eternal',
    coste: 0,
    ataque: 10,
    defensa: 8,
    imagen: 'assets/cartas/eternal-de-las-forjas.jpg',
    imagenFlotante: 'assets/personajes-flotantes/cri_atar-flotante.png',
    habilidades: [
      {
        n: 1,
        nombre: 'Convocar',
        texto:
          'Convoca un esbirro de las forjas de coste 3 por cada personaje activo. ' +
          'Si hay un esbirro en campo, no puedes atacar al eternal.',
        _aviso:
          'La carta dice «del oasis», copiado de Brahma; aquí el esbirro es el de las forjas.'
      },
      {
        n: 2,
        nombre: 'Aplacar',
        texto: 'Derrama dos sangres de la pila de todos los jugadores.'
      },
      {
        n: 3,
        nombre: 'Devastar',
        texto:
          'Infringe un ataque de 10 al grupo +1 por cada dos sangres derramadas. ' +
          'El daño se distribuye entre todos los personajes activos; si no lo hay, ' +
          'infringe daño directo a la pila de sangres.'
      },
      {
        n: 4,
        nombre: 'Intimidar',
        texto:
          'Todos los personajes oponentes ven su ataque o defensa reducido en 2 ' +
          'durante una serie.'
      }
    ]
  }
];

// Se registran solo en el índice por id, que es lo que consulta el combate.
window.Game.CHARACTERS_BY_ID = window.Game.CHARACTERS_BY_ID || {};
for (const c of window.Game.CREATURES) {
  window.Game.CHARACTERS_BY_ID[c.id] = c;
}

window.Game.esCriatura = function (personajeId) {
  const c = window.Game.CHARACTERS_BY_ID[personajeId];
  return !!c && (c.raza === 'criatura' || c.raza === 'eternal');
};

/**
 * Calabozos del modo historia.
 *
 * Cada raza recorre su propio calabozo en 6 etapas. No te enfrentas a un mazo
 * rival, sino a oleadas de criaturas que crecen en número y fuerza hasta el
 * Eternal corrompido.
 *
 * Progresión: empiezas solo con tu personaje de coste 0 y tres acciones. Cada
 * etapa superada suma un personaje y una acción, así que llegas al jefe con
 * el equipo completo.
 *
 * En posición solo cabe UN personaje, igual que en un duelo normal: lo que
 * crece es a quién puedes sacar, no cuántos sostienes a la vez. Las oleadas
 * enemigas sí despliegan varias criaturas simultáneas.
 *
 * La campaña es lineal y su orden lo marca `RACE_ORDER`.
 *
 * Cinemáticas (`core/cinematica.js`): el fundido a negro con texto dorado que
 * se lanza en tres momentos. Los tres campos son opcionales y su forma es
 * `{ texto }`:
 *
 * - `cinematica` en el calabozo: al llegar a su pantalla, una vez por sesión.
 * - `cineEntrada` en la etapa: al pulsar Entrar, antes de la mesa.
 * - `cineVictoria` en la etapa: al ganarla, antes del cartel de Victoria.
 *
 * **Aquí no se escriben duraciones.** El tiempo lo calcula el módulo desde el
 * largo del texto, a `Cinematica.CARACTERES_POR_SEGUNDO`, así que todas las
 * cinemáticas del juego van al mismo ritmo de lectura y editar una frase ajusta
 * su tiempo sola. Se puede forzar un valor pasando `segundos` a `mostrar()`,
 * pero hoy no lo hace nadie y conviene que siga así.
 */
window.Game = window.Game || {};

/**
 * Acciones que el calabozo reparte entre sus criaturas cada turno. Vive aquí,
 * con el resto de datos de calabozo, para no depender del orden de carga de
 * las pantallas.
 */
window.Game.ACCIONES_CALABOZO = [
  'o_finta',
  'o_inmolacion',
  'o_rompescudos',
  'd_bloquear',
  'd_acrobatico',
  'd_escape',
  'n_ruego',
  'n_comodin'
];

/**
 * Las dos únicas acciones que llevan las primeras oleadas: una ofensiva y una
 * defensiva, las dos de dado y sin efectos que muevan piezas por el tablero.
 * Son la versión enseñable del combate —tira, suma, pega— y dejan fuera las
 * que hacen falta explicar (Inmolación se suicida, Rompescudos apaga las
 * cartas, Escape cambia de personaje, Comodín encadena otra carta).
 */
window.Game.ACCIONES_CALABOZO_BASICAS = ['o_finta', 'd_acrobatico'];

/** Hasta esta etapa incluida, la oleada solo usa las básicas. */
window.Game.ETAPAS_CON_ACCIONES_BASICAS = 2;

/**
 * Qué acciones lleva la oleada de una etapa.
 *
 * Las dos primeras etapas de cada calabozo van con `ACCIONES_CALABOZO_BASICAS`
 * a propósito: la 1 es además donde vive el recorrido del tutorial, y una
 * primera partida en la que el rival se autodestruye o te apaga las cartas
 * enseña ruido en vez de las reglas. De la 3 en adelante entra el mazo entero.
 *
 * Ojo: esto acota lo que la oleada PUEDE equipar, no lo que sabe aplicar. Los
 * efectos siguen saliendo de `core/accionesIA.js`, y las dos básicas están
 * automatizadas las dos, así que en las etapas 1 y 2 no hay ninguna carta
 * rival que se quede inerte.
 */
window.Game.accionesDeOleada = function (nEtapa) {
  return nEtapa <= window.Game.ETAPAS_CON_ACCIONES_BASICAS
    ? [...window.Game.ACCIONES_CALABOZO_BASICAS]
    : [...window.Game.ACCIONES_CALABOZO];
};

window.Game.DUNGEONS = {
  desterrado: {
    id: 'bosque_nocturno',
    raza: 'desterrado',
    nombre: 'El Bosque Nocturno',
    eternal: 'cri_uldar',
    // Tema del escenario 2D por el que se avanza entre etapas (ui/temas2d.js).
    // Un calabozo sin él usa la travesía sobre el mapa.
    escenario2d: 'bosque',

    // El mapa de avance del lateral. `nodos` son coordenadas EN PÍXELES DE LA
    // IMAGEN (no del SVG del sendero anterior), una por etapa, plantadas a
    // mano sobre el hueco iluminado entre las raíces: sube desde el suelo del
    // bosque hasta el tocón que brilla arriba. Ver `Screens.historia.mapaDeAvance`.
    mapa: {
      imagen: 'assets/mapas/desterrado.jpg',
      ancho: 403,
      alto: 672,
      nodos: [
        { x: 165, y: 605 },
        { x: 255, y: 505 },
        { x: 170, y: 400 },
        { x: 215, y: 290 },
        { x: 185, y: 175 },
        { x: 210, y: 85 }
      ]
    },

    // Lo que deja el Eternal al caer. No se usa para nada: es constancia de
    // que lo derribaste, y una de las cuatro que abren la historia final.
    gema: {
      id: 'gema_orden',
      nombre: 'Cristal del Orden',
      sigil: '◈',
      // Ámbar con fuego dentro (gemas asignadas por Oscar).
      imagen: 'assets/gemas/desterrado.webp',
      brillo: '#ffb22e',
      mensaje:
        'El cristal de Iskar late todavía con la luz enferma del bosque. ' +
        'Solo, no sirve de nada: para limpiarlo hacen falta los otros tres.'
    },
    intro:
      'Annia despertó la luz del Orden en sus manos, y su pueblo la echó ' +
      'por ello. Esa misma noche cruza el linde del Bosque Nocturno, el ' +
      'viejo hogar de los sabios, y descubre que la corrupción llegó ' +
      'antes que ella.',

    // Escena de entrada al calabozo, ANTES del texto dorado. Opcional: el
    // calabozo que no la tenga pasa directo a su `cinematica`.
    //
    // `conSonido` se pone según lo que traiga el archivo: esta pista está en
    // silencio digital, así que va muda y no se pierde nada. La música del
    // calabozo sigue sonando en los dos casos.
    videoIntro: { src: 'assets/video/desterrado-intro.mp4', conSonido: false },

    cinematica: {
      texto:
        'El Bosque Nocturno fue cuna de sabios: aquí se pensaba despacio y ' +
        'se hablaba en voz baja. Hoy huele a podredumbre. Bestias ' +
        'enloquecidas, bandidos y conspiradores se reparten la espesura, y ' +
        'nadie sabe qué fue de su guardián.'
    },

    // Las acciones con las que arrancas, antes de cualquier desbloqueo.
    accionesIniciales: ['o_finta', 'd_bloquear', 'n_ruego'],
    personajesIniciales: ['des_annia'],

    etapas: [
      {
        n: 1,
        titulo: 'Ojos en la maleza',
        // Vitalidad de la oleada: su sangre inicial en vez de 30. Es la palanca
        // de dificultad que no toca ninguna carta impresa (ver CLAUDE.md).
        sangre: 5,
        criaturas: ['cri_ratas'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'des_annia', texto: 'Primera noche fuera de los muros… y el bosque no está vacío.' },
          { quien: 'des_annia', texto: 'Esos ojos. Ninguna rata tiene ese verde.' },
          { quien: 'des_annia', texto: 'Tranquila. Es solo luz. Tu luz.' },
        ],
        narracion:
          'La primera noche fuera de los muros, Annia aprende que el bosque ' +
          'no está vacío. Algo pequeño y numeroso la observa desde la maleza,' +
          ' con un verde en los ojos que ninguna alimaña debería tener.',
        cineEntrada: {
          texto:
            'Las ratas no huyen de ella. La rodean, se detienen todas a la vez ' +
            'y esperan, como si alguien les hubiera dicho que esperaran.'
        },
        cineVictoria: {
          texto:
            'Una magia vil se ha adueñado de las criaturas del bosque. Pero ' +
            'Annia ya no camina sola.'
        },
        recompensa: { personaje: 'des_axel', accion: 'o_captura' },
        textoRecompensa:
          'Axel, un muchacho que lleva semanas escondido en el bosque, sale ' +
          'de entre los árboles al oír la pelea. No le pregunta el nombre: ' +
          'solo le ofrece agua.'
      },
      {
        n: 2,
        titulo: 'El que caza de noche',
        sangre: 8,
        criaturas: ['cri_ratas', 'cri_lobo'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'des_axel', texto: 'Bebe. Llevo semanas escondido aquí: no eres la única a la que el bosque no quiere.' },
          { quien: 'des_annia', texto: 'Gracias… ¿Oíste eso?' },
          { quien: 'des_axel', texto: 'Las ratas no cazan solas. Algo grande va detrás, esperando a que ellas abran la herida.' },
        ],
        narracion:
          'Las ratas no cazaban solas. Algo más grande las sigue y deja que ' +
          'ellas abran la herida antes de morder. Axel lo ve primero; siempre' +
          ' ve primero.',
        cineEntrada: {
          texto:
            'Dicen que en lo hondo del bosque aún viven los sabios. Si es ' +
            'verdad, hay que llegar hasta ellos antes de que el bosque llegue a' +
            ' Annia.'
        },
        cineVictoria: {
          texto:
            'Entre los árboles, otra luz responde a la de Annia. La leyenda era' +
            ' cierta: los sabios están más cerca de lo que parece.'
        },
        recompensa: { personaje: 'des_thiana', accion: 'd_escape' },
        textoRecompensa:
          'Thiana llega siguiendo la luz que Annia deja sin querer. A ella ' +
          'también la echaron por brillar en la oscuridad.'
      },
      {
        n: 3,
        titulo: 'La manada de los sin nombre',
        sangre: 18,
        criaturas: ['cri_ratas', 'cri_lobo', 'cri_gnolls'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'des_thiana', texto: 'Seguí tu luz. A mí también me echaron por brillar.' },
          { quien: 'des_annia', texto: 'Mira cómo se mueven. Ya no son bestias sueltas.' },
          { quien: 'des_thiana', texto: 'Alguien les dice dónde morder. Déjame mostrártelo: la luz no miente.' },
        ],
        narracion:
          'Ya no son bestias sueltas: se mueven en orden, cierran el paso, ' +
          'rodean. Alguien, en alguna parte, les está diciendo dónde morder.',
        cineEntrada: {
          texto:
            'Los conspiradores se han adueñado del bosque. Pero en lo más ' +
            'hondo, dicen, todavía arde una esperanza. Hay que seguir ' +
            'avanzando.'
        },
        cineVictoria: {
          texto:
            'Los gnolls nunca fueron gente de fiar, pero esto es otra cosa: es ' +
            'crueldad aprendida. —Iskar, guardián del bosque… ayúdanos.'
        },
        recompensa: { personaje: 'des_erem', accion: 'd_acrobatico' },
        textoRecompensa:
          'Erem los observaba desde antes de la pelea. Es un maestro: enseña ' +
          'a los jóvenes a defenderse, y ya ha visto esto antes.'
      },
      {
        n: 4,
        titulo: 'Manos humanas',
        sangre: 13,
        criaturas: ['cri_gnolls', 'cri_conspiradores'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'des_erem', texto: 'Las bestias no se organizan solas, muchacha.' },
          { quien: 'des_annia', texto: 'Hay hombres entre los gnolls. Sin magia, sin marca…' },
          { quien: 'des_erem', texto: 'Por eso son peligrosos: no tienen nada que perder. Quédate cerca.' },
        ],
        narracion:
          'Entre los gnolls caminan hombres. Sin magia, sin marca, sin ' +
          'corrupción en la piel. Dan órdenes, y las bestias obedecen.',
        cineEntrada: {
          texto:
            'Desde la Gran Lluvia, la envidia corroe a los que no recibieron ' +
            'nada. Los sin don buscan poder a cualquier precio… y alguien les ' +
            'ha enseñado dónde encontrarlo.'
        },
        cineVictoria: {
          texto:
            'Los responsables ya tienen rostro: hombres comunes con ideas ' +
            'profundamente peligrosas. Lo que todavía no se sabe es qué quieren' +
            ' del bosque.'
        },
        recompensa: { personaje: 'des_lydia', accion: 'n_ocultamiento' },
        textoRecompensa:
          'Lydia reconoce los símbolos que los conspiradores llevan cosidos. ' +
          'Lleva media vida estudiando encantamientos y sabe leer lo que ' +
          'otros solo ven.'
      },
      {
        n: 5,
        titulo: 'Los que no tienen don',
        sangre: 20,
        criaturas: ['cri_conspiradores'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'des_lydia', texto: 'Esos símbolos cosidos… los conozco. No son de protección.' },
          { quien: 'des_annia', texto: '¿Qué buscan, entonces?' },
          { quien: 'des_lydia', texto: 'No quieren matar al Eternal del Orden. Quieren que les obedezca. Y lo están consiguiendo.' },
        ],
        narracion:
          'Sin bestias que los cubran, los conspiradores se muestran tal cual' +
          ' son. Lydia lo dice en voz alta y nadie quiere creerlo: no ' +
          'vinieron a matar al Eternal del Orden. Vinieron a corromperlo. Y ' +
          'lo están consiguiendo.',
        cineEntrada: {
          texto:
            'Iskar ya no oye la voz de su padre, el Orden. En su silencio solo ' +
            'queda otra voz, que le habla cada día: la de los conspiradores.'
        },
        cineVictoria: {
          texto:
            'Hay que llegar hasta el Eternal y recordarle quién es. Sin la ' +
            'magia del Orden, Aether’Num se vendrá abajo.'
        },
        recompensa: { personaje: 'des_auram', accion: 'n_investigar' },
        textoRecompensa:
          'Auram llega tarde a la pelea y temprano a la verdad. Él y Erem se ' +
          'miran sin decir nada: los dos saben adónde hay que ir ahora.'
      },
      {
        n: 6,
        titulo: 'Iskar, lo que queda del Orden',
        sangre: 35,
        // El Eternal se presenta primero y lanza desde su primer turno; los
        // esbirros le cubren (si salía el último, casi nunca llegaba a salir).
        criaturas: ['cri_uldar', 'cri_esbirro_bosque', 'cri_esbirro_bosque'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'des_auram', texto: 'Erem y yo sabemos adónde hay que ir. Al centro.' },
          { quien: 'des_annia', texto: 'Ahí está Iskar… todavía parece él.' },
          { quien: 'des_auram', texto: 'Esa es la peor parte, Annia. No venimos a matar a un monstruo.' },
          { quien: 'des_annia', texto: 'Venimos a impedir que nazca uno.' },
        ],
        esJefe: true,
        narracion:
          'El Eternal del Orden sigue en pie, enorme y luminoso, y esa es la ' +
          'peor parte: todavía parece él. Los esbirros que lo rodean brotaron' +
          ' de su propia luz enferma. La banda entiende, demasiado tarde, que' +
          ' no viene a matar a un monstruo, sino a impedir que uno nazca.',
        cineEntrada: {
          texto:
            'En el corazón del bosque late una luz enorme, con un ritmo que no ' +
            'es el suyo. Iskar repite órdenes ajenas con una voz que todavía ' +
            'suena a justicia.'
        },
        cineVictoria: {
          texto:
            'Iskar ha caído. De su pecho rueda un cristal que aún late con luz ' +
            'enferma. Si alguien supiera limpiarlo, el guardián del bosque ' +
            'podría volver a ser quien fue.'
        },
        recompensa: null,
        textoRecompensa: null
      }
    ]
  },

  lunaria: {
    id: 'oasis',
    raza: 'lunaria',
    nombre: 'El Oasis',
    eternal: 'cri_brahma',
    // Tema del escenario 2D (ui/temas2d.js).
    escenario2d: 'oasis',

    // Sube por el cañón entre cristales hasta la plataforma ritual bajo la luna.
    mapa: {
      imagen: 'assets/mapas/lunaria.jpg',
      ancho: 397,
      alto: 672,
      nodos: [
        { x: 195, y: 610 },
        { x: 275, y: 460 },
        { x: 135, y: 360 },
        { x: 205, y: 260 },
        { x: 175, y: 165 },
        { x: 195, y: 105 }
      ]
    },

    gema: {
      id: 'gema_vida',
      nombre: 'Cristal del Jardín',
      sigil: '◈',
      // Blanca, agrietada por dentro.
      imagen: 'assets/gemas/lunaria.webp',
      brillo: '#dfe7ff',
      mensaje:
        'El cristal de Brahma sigue tibio, como una semilla que no se ' +
        'decide a abrir. Guárdalo: solo, no hará crecer nada.'
    },
    intro:
      'Sadash sigue el rastro de una luna que no debería estar menguando,' +
      ' y la encuentra colgada sobre el único lugar de Aether’Num donde ' +
      'aún crece algo. No va sola: sus espíritus acompañantes no la dejan' +
      ' nunca. Si el Oasis cae, no quedará nada que refleje la luz de su ' +
      'diosa.',
    // Esta sí trae audio de verdad (-20 dB de media), así que suena.
    videoIntro: { src: 'assets/video/lunaria-intro.mp4', conSonido: true },

    cinematica: {
      texto:
        'Desde hace milenios, el Oasis da descanso a los afligidos: aquí el' +
        ' dolor termina y el cansancio se apaga. Pero la Gran Lluvia ' +
        'despertó en los Lunaria una idea nueva sobre su antigua vocación, ' +
        'y no todos la entendieron igual.'
    },
    accionesIniciales: ['o_finta', 'd_bloquear', 'n_ruego'],
    // Sadash no aguanta sola la primera oleada de centauros, así que los
    // espíritus acompañantes entran con ella desde la etapa 1 en vez de ser
    // la recompensa de la 2. Ver la nota de la etapa 2.
    personajesIniciales: ['lun_sadash', 'lun_acompanantes'],

    etapas: [
      {
        n: 1,
        titulo: 'Cascos en la niebla',
        sangre: 6,
        criaturas: ['cri_centauro'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'lun_sadash', texto: 'Tenemos que llegar a la arboleda antes del alba. Los míos tienen que saber lo que está pasando.' },
          { quien: 'lun_acompanantes', texto: '(El lobo se detiene. El cuervo grazna hacia la niebla: algo se mueve entre los árboles.)' },
          { quien: 'lun_sadash', texto: 'Cascos… Son los centauros. Vigilan este bosque desde antes de la Gran Lluvia. Ellos no atacarían…' },
        ],
        narracion:
          'Los centauros vigilan el bosque del Oasis desde antes de la Gran ' +
          'Lluvia. Ahora disparan a cualquier cosa que se mueva, y Sadash se ' +
          'mueve muy despacio.',
        cineEntrada: {
          texto:
            'Sadash debe llegar a la arboleda y advertir a los suyos: las ' +
            'criaturas del bosque se están volviendo agresivas de un día para ' +
            'otro.'
        },
        cineVictoria: {
          texto:
            'Algo no anda bien. Los centauros jamás se habían vuelto contra los' +
            ' habitantes del bosque. ¿Qué los empuja?'
        },
        recompensa: { personaje: 'lun_delem', accion: 'o_captura' },
        textoRecompensa:
          'Delem va detrás de ella sin que se lo pidan. Dice que la ' +
          'vanguardia no deja que nadie entre sola en la oscuridad.'
      },
      {
        n: 2,
        titulo: 'Bajo las raíces',
        sangre: 10,
        criaturas: ['cri_centauro', 'cri_troles'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'lun_delem', texto: 'Te alcancé, Sadash. Los troles no duermen: llevan meses despiertos.' },
          { quien: 'lun_sadash', texto: 'La noche siempre los cubrió con su velo. ¿Qué les está robando el descanso?' },
          { quien: 'lun_delem', texto: 'No lo sé. Pero algo en este bosque ya no quiere que nada se acabe.' },
        ],
        narracion:
          'Los troles salen de donde el bosque es más espeso. La corrupción ' +
          'les ha quitado el sueño: llevan meses despiertos, y furiosos.',
        cineEntrada: {
          texto:
            'La noche siempre cubrió con su velo a todas las criaturas: unas ' +
            'duermen, otras salen a cazar. Pero en este bosque ya nadie duerme,' +
            ' y el desvelo los está volviendo locos.'
        },
        cineVictoria: {
          texto:
            'La noche es pariente de la muerte: descanso para unos, vigilia ' +
            'para otros. Y algo le está robando la mitad que descansa.'
        },
        // Única recompensa sin personaje del juego: los acompañantes ya venían
        // en el equipo desde la etapa 1, y no hay un séptimo lunaria que dar.
        recompensa: { accion: 'd_escape' },
        textoRecompensa:
          'Los espíritus se adelantan entre las raíces y le enseñan por dónde' +
          ' no pasan los troles. Nadie nuevo se suma a la banda: lo que se ' +
          'suma es una manera de salir viva.'
      },
      {
        n: 3,
        titulo: 'El claro equivocado',
        sangre: 5,
        criaturas: ['cri_centauro', 'cri_troles', 'cri_culto_eclipse'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'lun_delem', texto: 'Ese claro… hay alguien ahí. Son de los nuestros.' },
          { quien: 'lun_sadash', texto: 'Conozco esa cara. Pero esos ojos blancos… no parpadean.' },
          { quien: 'lun_delem', texto: 'Es lo que queda de un lunaria cuando la luna se le apaga del todo.' },
        ],
        narracion:
          'Entre los árboles hay elfos de ojos blancos que no parpadean. ' +
          'Sadash tarda en decirlo en voz alta: son de los suyos, o lo que ' +
          'queda de un lunaria cuando la luna se le apaga del todo.',
        cineEntrada: {
          texto:
            'A lo lejos, un rostro conocido. Pero su mirada ya no tiene luna.'
        },
        cineVictoria: {
          texto:
            'Hay Lunaria que perdieron el vínculo con la muerte sagrada. Los ' +
            'guardianes del descanso se cansaron de su misión… y ahora quieren ' +
            'algo para sí mismos.'
        },
        recompensa: { personaje: 'lun_falum', accion: 'd_acrobatico' },
        textoRecompensa:
          'Fälum llega con el eco de muchedumbres en la voz. Donde él está, ' +
          'dicen, la diosa no anda lejos.'
      },
      {
        n: 4,
        titulo: 'El culto del eclipse',
        sangre: 5,
        criaturas: ['cri_troles', 'cri_culto_eclipse'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'lun_falum', texto: 'No vinieron a matar el Oasis, muchacha. Vinieron a taparlo.' },
          { quien: 'lun_sadash', texto: 'Sin luz, lo que crece deja de crecer…' },
          { quien: 'lun_falum', texto: '…y lo que duerme deja de despertar. Abandonaron el sagrado descanso. Quieren mover los límites.' },
        ],
        narracion:
          'No vinieron a matar el Oasis. Vinieron a taparlo. Sin luz, lo que ' +
          'crece deja de crecer, y lo que duerme deja de despertar.',
        cineEntrada: {
          texto:
            'Un grupo de Lunaria ha abandonado el camino del sagrado descanso. ' +
            'Dicen que el viejo equilibrio no volverá, y que ha llegado la hora' +
            ' de mover los límites de lo posible.'
        },
        cineVictoria: {
          texto:
            'La Gran Lluvia movió los límites de lo imaginable. La magia que ' +
            'antes se suplicaba a los Eternos corre hoy por las venas de los ' +
            'mortales: sirve para proteger, y también para romper el mundo.'
        },
        recompensa: { personaje: 'lun_seluah', accion: 'o_luna_sangrienta' },
        textoRecompensa:
          'Seluah escucha lo que ninguno oye, y traduce: el culto ya no manda' +
          ' aquí. Alguien lo manda a él.'
      },
      {
        n: 5,
        titulo: 'La raíz que respira',
        sangre: 12,
        criaturas: ['cri_culto_eclipse', 'cri_esbirro_oasis'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'lun_seluah', texto: 'Escucha, Sadash. El bosque respira, pero no como antes.' },
          { quien: 'lun_sadash', texto: 'Se está levantando contra nosotras.' },
          { quien: 'lun_seluah', texto: 'No distingue entre enemigo y auxilio. Aquí ya nada termina: ni el dolor, ni el cansancio.' },
        ],
        narracion:
          'El bosque se levanta contra ellas. Los esbirros no son criaturas ' +
          'del culto: son el propio Oasis, defendiéndose de todo el que entra' +
          ' sin distinguir ya entre enemigo y auxilio.',
        cineEntrada: {
          texto:
            'Un Oasis que ya no da descanso, ni pone fin al dolor, al ' +
            'cansancio, a la tristeza. Aquí todo permanece para siempre. Nada ' +
            'termina.'
        },
        cineVictoria: {
          texto:
            'Las criaturas del Oasis están confundidas: el Eternal de la Muerte' +
            ' ya no hace su trabajo. ¿Significa que nadie volverá a morir? ¿Es ' +
            'esto vivir para siempre?'
        },
        recompensa: { personaje: 'lun_lirhym', accion: 'n_investigar' },
        textoRecompensa:
          'Lirhym llega en persona. Que la Reina abandone el bosque alto ' +
          'significa que lo del Oasis ya no es asunto de una sola arboleda.'
      },
      {
        n: 6,
        titulo: 'Brahma, el jardín que se cerró',
        sangre: 8,
        // El Eternal se presenta primero y lanza desde su primer turno; los
        // esbirros le cubren (si salía el último, casi nunca llegaba a salir).
        criaturas: ['cri_brahma', 'cri_esbirro_oasis', 'cri_esbirro_oasis'],
        // BORRADOR de Claude (docs/BIBLIA.md): Oscar lo reemplaza por el
        // suyo. Lo dicen al andar, antes de los enemigos.
        dialogo: [
          { quien: 'lun_lirhym', texto: 'Ahí está Brahma. Todavía brilla.' },
          { quien: 'lun_sadash', texto: 'Es hermoso… Cuesta aceptar lo que sostiene.' },
          { quien: 'lun_lirhym', texto: 'No sostiene la vida del bosque, Sadash. Sostiene su encierro.' },
          { quien: 'lun_sadash', texto: 'Entonces hay que devolverle su final.' },
        ],
        esJefe: true,
        narracion:
          'Brahma, el Eternal de la Muerte, todavía brilla, y esa luz sigue ' +
          'siendo hermosa. Por eso cuesta tanto aceptar que lo que sostiene ' +
          'ya no es la vida del bosque, sino su encierro.',
        cineEntrada: {
          texto:
            'Es como si el tiempo no pasara aquí. Una extraña sensación de ' +
            'permanencia… ¿Esto es la inmortalidad?'
        },
        cineVictoria: {
          texto:
            'Todo lo que tiene un comienzo tiene un final. La vida termina, las' +
            ' alegrías acaban… pero también el dolor.'
        },
        recompensa: null,
        textoRecompensa: null
      }
    ]
  },

  reanimado: {
    id: 'catacumbas',
    raza: 'reanimado',
    nombre: 'Las Catacumbas',
    eternal: 'cri_tarh_akh',

    // Al revés que las otras tres: aquí se BAJA, de la catedral en superficie
    // a las escaleras de la cripta al fondo. Encaja con la intro: «Luh baja a
    // la metrópolis caída».
    mapa: {
      imagen: 'assets/mapas/reanimado.jpg',
      ancho: 389,
      alto: 672,
      nodos: [
        { x: 195, y: 140 },
        { x: 195, y: 225 },
        { x: 195, y: 340 },
        { x: 195, y: 430 },
        { x: 195, y: 530 },
        { x: 195, y: 630 }
      ]
    },

    gema: {
      id: 'gema_retorno',
      nombre: 'Cristal del Retorno',
      sigil: '◈',
      // Negra con savia verde.
      imagen: 'assets/gemas/reanimado.webp',
      brillo: '#5dff7a',
      mensaje:
        'El cristal de Tarh Akh pesa más de lo que debería, como si trajera' +
        ' algo dentro. Que descanse ahí hasta que estén los cuatro.'
    },
    intro:
      'Luh baja a la metrópolis caída, donde algo lleva semanas ' +
      'impidiendo que los muertos descansen. Si alguien sabe lo que eso ' +
      'pesa, es quien ya volvió una vez.',

    // Audio real (-19,4 dB de media), así que suena.
    videoIntro: { src: 'assets/video/reanimado-intro.mp4', conSonido: true },

    cinematica: {
      texto:
        'La magia de la Vida es un milagro. Pero en manos de quien no ' +
        'soporta perder, en manos del dolor, se sale de control con una ' +
        'facilidad aterradora.'
    },
    // Inmolación desde el inicio, en las seis etapas (Oscar): los muertos no
    // temen deshacerse. Por eso la etapa 2 ya no regala Escape.
    accionesIniciales: ['o_finta', 'd_bloquear', 'n_ruego', 'o_inmolacion'],
    // Luh no baja sola: el Ejército y Gurh entran con ella desde la etapa 1 en
    // vez de ser las recompensas de la 1 y la 2. Ver las notas de esas etapas.
    personajesIniciales: ['rea_luh', 'rea_ejercito', 'rea_gurh'],

    etapas: [
      {
        n: 1,
        titulo: 'Los que no descansan',
        sangre: 6,
        criaturas: ['cri_condenados'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'rea_luh', texto: 'Bajen despacio. El agua no deja ver el fondo.' },
          { quien: 'rea_gurh', texto: 'Algo se mueve ahí dentro. Muchos.' },
          { quien: 'rea_luh', texto: 'No atacan por hambre, Gurh. Atacan porque nadie les ha dado permiso para detenerse.' },
        ],
        narracion:
          'El agua de las alcantarillas le llega a las rodillas, y algo se ' +
          'mueve dentro. Luh reconoce el gesto: no atacan por hambre, atacan ' +
          'porque nadie les ha dado permiso para detenerse.',
        cineEntrada: {
          texto:
            '¿Por qué se han levantado? Caminan sin memoria, buscando una ' +
            'razón, todos hacia el mismo lugar: el pozo del que salieron.'
        },
        cineVictoria: {
          texto:
            '¿Qué clase de magia los despierta así, tan a medias, tan cruel?'
        },
        // Sin personaje: el Ejército ya baja con Luh desde el principio.
        recompensa: { accion: 'o_captura' },
        textoRecompensa:
          'Nadie nuevo se suma: los que bajaron con Luh son los que hay. Lo ' +
          'que se aprende aquí es a agarrar al que huye.'
      },
      {
        n: 2,
        titulo: 'Lo que rezuma',
        // 15 era imposible jugando a mano (Oscar); medido con la IA: 74 % → 89 %.
        sangre: 8,
        criaturas: ['cri_condenados', 'cri_slime'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'rea_gurh', texto: 'Eso… eso era gente.' },
          { quien: 'rea_luh', texto: 'La corrupción no solo levanta. También disuelve, y vuelve a juntar.' },
          { quien: 'rea_gurh', texto: 'Mi pueblo cayó entero. No dejaré que les hagan esto.' },
        ],
        narracion:
          'La corrupción no solo levanta cadáveres: también los disuelve y ' +
          'los vuelve a juntar. Lo que avanza por el túnel ya no tiene forma ' +
          'de nada que haya vivido.',
        cineEntrada: {
          texto:
            'Esta magia solo sabe causar sufrimiento. Pobres almas.'
        },
        cineVictoria: {
          texto:
            'Ya no hay duda: alguien está usando la magia de la Vida para ' +
            'levantar a la gente de esta ciudad.'
        },
        // Sin personaje: Gurh también venía en el equipo de salida.
        // Sin recompensa: Inmolación ya viene desde el inicio (Oscar).
        recompensa: null
      },
      {
        n: 3,
        titulo: 'La cripta abierta',
        sangre: 8,
        criaturas: ['cri_condenados', 'cri_slime', 'cri_nigromante'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'rea_luh', texto: 'Un hombre vivo, dando órdenes a los muertos.' },
          { quien: 'rea_gurh', texto: '¿Lo conoces?' },
          { quien: 'rea_luh', texto: 'Conozco lo que siente. Amó tanto que no supo soltar. Por eso me da miedo.' },
        ],
        narracion:
          'Al fondo hay un hombre vivo dando órdenes a los muertos. No es un ' +
          'monstruo: es alguien que amó tanto que decidió no soltar. Esa es ' +
          'la parte que Luh no sabe cómo combatir.',
        cineEntrada: {
          texto:
            'Al fondo de una gran galería recita sus hechizos quien fuera un ' +
            'gran orador, líder de muchedumbres. Del reino solo quedan ' +
            'despojos, y él ya no distingue dónde termina el amor y dónde ' +
            'empieza el crimen.'
        },
        cineVictoria: {
          texto:
            'Un hombre desesperado está dispuesto a cualquier cosa por ' +
            'recuperar lo que perdió.'
        },
        recompensa: { personaje: 'rea_vyla', accion: 'd_acrobatico' },
        textoRecompensa:
          'Vyla, la primera de todos ellos, reconoce lo que el nigromante ' +
          'está haciendo. Lo vio una vez, en su ciudad, la noche que cayó.'
      },
      {
        n: 4,
        titulo: 'Marea de huesos',
        sangre: 4,
        criaturas: ['cri_slime', 'cri_nigromante'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'rea_vyla', texto: 'Lo vi una vez. En mi ciudad, la noche que cayó.' },
          { quien: 'rea_luh', texto: '¿Y cómo terminó?' },
          { quien: 'rea_vyla', texto: 'No terminó. Por eso sigo aquí.' },
        ],
        narracion:
          'El nigromante ya no finge. Cada muerto que la banda libera vuelve ' +
          'a levantarse dos túneles más allá, y la cuenta nunca baja.',
        cineEntrada: {
          texto:
            'La magia de la Vida es asombrosa: puede sostener incluso al ' +
            'nigromante, herido de muerte en la batalla.'
        },
        cineVictoria: {
          texto:
            'Si esta magia puede devolver un reino entero, no debería estar en ' +
            'manos de un solo hombre enamorado. Cada uno de los que volvieron ' +
            'mira al nigromante… y aprende.'
        },
        recompensa: { personaje: 'rea_zabar', accion: 'n_llamada' },
        textoRecompensa:
          'Zabar llega oliendo la sangre. Su última memoria sigue grabada en ' +
          'la retina, y hoy por fin sirve de algo.'
      },
      {
        n: 5,
        titulo: 'La voz bajo la piedra',
        sangre: 10,
        criaturas: ['cri_nigromante', 'cri_esbirro_catacumbas'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'rea_zabar', texto: 'Huelo su sangre. Está asustado.' },
          { quien: 'rea_luh', texto: 'Mira las paredes, Zabar. Él tampoco sabe qué estaba alimentando.' },
          { quien: 'rea_zabar', texto: 'Me da igual. Lo único que recuerdo es a mi hija.' },
        ],
        narracion:
          'De las paredes brota algo que no es carne ni piedra. El nigromante' +
          ' retrocede: tampoco él sabía qué había estado alimentando.',
        cineEntrada: {
          texto:
            'Algo despierta bajo la piedra, y el nigromante ya no lo controla. ' +
            'Una batalla a dos bandos está a punto de estallar.'
        },
        cineVictoria: {
          texto:
            'Pobre alma atormentada. Aj’Khul, consejero del rey y amante de la ' +
            'reina, hizo lo imposible por devolverle la vida a ella. Ya no ' +
            'queda nada de quien fue: lo llevó todo demasiado lejos. Mientras ' +
            'la piedra se derrumba, escapa entre la niebla.'
        },
        recompensa: { personaje: 'rea_thila', accion: 'n_investigar' },
        textoRecompensa:
          'Thila recuerda ritos que sirvió antes de la Catástrofe. Ninguno ' +
          'estaba pensado para esto, pero algunos casi encajan.'
      },
      {
        n: 6,
        titulo: 'Tarh Akh, lo que la muerte olvidó',
        sangre: 12,
        // El Eternal se presenta primero y lanza desde su primer turno; los
        // esbirros le cubren (si salía el último, casi nunca llegaba a salir).
        criaturas: ['cri_tarh_akh', 'cri_esbirro_catacumbas', 'cri_esbirro_catacumbas'],
        esJefe: true,
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'rea_thila', texto: 'Recuerdo estos ritos. Los serví antes de la Catástrofe.' },
          { quien: 'rea_luh', texto: '¿A quién servías?' },
          { quien: 'rea_thila', texto: 'Eso es lo único que no recuerdo.' },
          { quien: 'rea_luh', texto: 'Entonces sirve a esto: que por fin descanse.' },
        ],
        narracion:
          'Tarh Akh, el Eternal de la Vida, sostenía la frontera entre morir ' +
          'y volver. Corrompido, la ha borrado. Darle descanso es lo único ' +
          'piadoso que queda por hacer, y también lo más difícil.',
        cineEntrada: {
          texto:
            'La magia de la Vida ya no es solo de su Eterna. Su Eternal, antes ' +
            'fuente de fertilidad, es hoy fuente de podredumbre: desea con ' +
            'desesperación dar vida incluso a lo que debería volver al polvo.'
        },
        cineVictoria: {
          texto:
            'Con el Eternal caído, la magia de la Vida queda casi entera en ' +
            'manos de los Reanimados, que aprendieron sus bases mirando a ' +
            'Aj’Khul. Un nuevo imperio, un ejército que no se cansa, acaba de ' +
            'despertar. ¿Quién podrá ponerle fin?'
        },
        recompensa: null,
        textoRecompensa: null
      }
    ]
  },

  oxitron: {
    id: 'forjas',
    raza: 'oxitron',
    nombre: 'Las Forjas',
    eternal: 'cri_atar',

    // El primer nodo cae sobre la propia figura de Pip que el arte dibuja
    // agazapada en el saliente superior izquierdo; el último, en la torre con
    // el horno y la lava, arriba a la derecha —la forja de A'tar—.
    mapa: {
      imagen: 'assets/mapas/oxitron.jpg',
      ancho: 402,
      alto: 672,
      nodos: [
        { x: 90, y: 160 },
        { x: 95, y: 245 },
        { x: 195, y: 345 },
        { x: 100, y: 490 },
        { x: 310, y: 470 },
        { x: 290, y: 110 }
      ]
    },

    gema: {
      id: 'gema_forja',
      nombre: 'Cristal de la Forja',
      sigil: '◈',
      // Roja de carne, con venas verdes.
      imagen: 'assets/gemas/oxitron.webp',
      brillo: '#ff3d52',
      mensaje:
        'El cristal de A’tar no se ha apagado: dentro sigue habiendo fuego,' +
        ' esperando un yunque que todavía no tienes.'
    },
    intro:
      'Pip lleva catorce días fingiendo ser chatarra. Cuando por fin se ' +
      'levanta, descubre que la Forja de los Persecutores ya no obedece ' +
      'ni al Rey Caído.',
    // Audio real, aunque más bajo que los otros (-29,9 dB de media).
    videoIntro: { src: 'assets/video/oxitron-intro.mp4', conSonido: true },

    cinematica: {
      texto:
        'Los viejos dominios de un señor rígido y dictatorial: el hombre ' +
        'que se condenó a sí mismo a la soledad, rodeado solo de ' +
        'mecanizados sin alma propia.'
    },
    accionesIniciales: ['o_finta', 'd_bloquear', 'n_ruego'],
    personajesIniciales: ['oxi_pip'],

    etapas: [
      {
        n: 1,
        titulo: 'Escoria viva',
        sangre: 3,
        criaturas: ['cri_rocoso'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'oxi_pip', texto: 'Catorce días inmóvil. Registro: nadie vino a buscarme.' },
          { quien: 'oxi_pip', texto: 'Temperatura del suelo en aumento. Probabilidad de ser visto: baja.' },
          { quien: 'oxi_pip', texto: 'Corrección: alta.' },
        ],
        narracion:
          'La escoria que se acumula junto a los hornos ha empezado a abrir ' +
          'ojos. Pip calcula que, si no se mueve, no lo verán. Se equivoca.',
        cineEntrada: {
          texto:
            'Tras uno de los temblores, ahora tan frecuentes, algo ardiente se ' +
            'levanta por las grietas del suelo.'
        },
        cineVictoria: {
          texto:
            '¿Magia del Caos? Extraño. Estas forjas siempre fueron dominio de ' +
            'la vida y del orden.'
        },
        recompensa: { personaje: 'oxi_kaw', accion: 'o_captura' },
        textoRecompensa:
          'Kaw sale de un montón de piezas muertas y se sacude el óxido. ' +
          'Llevaba ahí desde antes que Pip, esperando lo mismo.'
      },
      {
        n: 2,
        titulo: 'Los hornos despiertos',
        sangre: 5,
        criaturas: ['cri_rocoso', 'cri_guardian'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'oxi_kaw', texto: 'Llevaba aquí desde antes que tú. Esperando lo mismo.' },
          { quien: 'oxi_pip', texto: '¿Órdenes?' },
          { quien: 'oxi_kaw', texto: 'Ninguna. Hace días que nadie nos da ninguna.' },
        ],
        narracion:
          'Un guardián de lava bloquea el paso a la galería baja. Lo pusieron' +
          ' ahí para proteger la forja de intrusos, y ya no distingue quién ' +
          'la construyó.',
        cineEntrada: {
          texto:
            'Algo va mal. Este lugar, antes ordenado al milímetro por un solo ' +
            'señor, se llena de fuerzas sin dueño que incluso luchan entre sí.'
        },
        cineVictoria: {
          texto:
            'Estas criaturas atacan sin piedad a todo lo que viene de otro ' +
            'dominio, como las máquinas vivientes. Los dominios de Aether’Num ' +
            'están en guerra.'
        },
        recompensa: { personaje: 'oxi_krag', accion: 'd_escape' },
        textoRecompensa:
          'Krag encaja los golpes que los otros no pueden. A cambio, va ' +
          'dejando tuercas por el camino.'
      },
      {
        n: 3,
        titulo: 'La cadena de montaje',
        sangre: 8,
        criaturas: ['cri_rocoso', 'cri_guardian', 'cri_horda'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'oxi_krag', texto: 'La línea de montaje sigue en marcha.' },
          { quien: 'oxi_pip', texto: '¿Fabricando qué?' },
          { quien: 'oxi_krag', texto: 'Nada que lleve nuestro diseño.' },
        ],
        narracion:
          'La forja no se ha parado: sigue fabricando. Lo que sale de la ' +
          'línea ya no son autómatas, sino cosas de roca y fuego que caminan ' +
          'como soldados.',
        cineEntrada: {
          texto:
            'Las viejas forjas se alimentan ahora de magia del Caos. Pero ¿cómo' +
            ' llegó el Caos hasta aquí?'
        },
        cineVictoria: {
          texto:
            'Si esto sigue, el continente entero se llenará de este enjambre de' +
            ' fuego sin ley.'
        },
        recompensa: { personaje: 'oxi_brawl', accion: 'd_acrobatico' },
        textoRecompensa:
          'Brawl llega con el paso pesado de un capitán que ya perdió una ' +
          'guerra y no piensa perder esta.'
      },
      {
        n: 4,
        titulo: 'Horda llameante',
        sangre: 6,
        criaturas: ['cri_guardian', 'cri_horda'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'oxi_brawl', texto: 'Marchan hacia la salida. Hacia los reinos de arriba.' },
          { quien: 'oxi_pip', texto: 'Eso no estaba en el protocolo.' },
          { quien: 'oxi_brawl', texto: 'Ya perdí una guerra, Pip. Esta no.' },
        ],
        narracion:
          'Ya no salen de uno en uno. Marchan en formación, con hachas ' +
          'fundidas al brazo, hacia una salida que da directamente a los ' +
          'reinos de arriba.',
        cineEntrada: {
          texto:
            'Han empezado a avanzar. Esta horda no se va a detener sola.'
        },
        cineVictoria: {
          texto:
            'Inaceptable: Caos en cada rincón. Todas las pistas apuntan a lo ' +
            'más profundo de las forjas. De ahí sale todo.'
        },
        recompensa: { personaje: 'oxi_krox', accion: 'd_encadenar' },
        textoRecompensa:
          'Krox se oye antes de verse. El persecutor incansable ha ' +
          'encontrado, por fin, algo que perseguir de vuelta.'
      },
      {
        n: 5,
        titulo: 'El corazón del yunque',
        sangre: 15,
        criaturas: ['cri_horda', 'cri_esbirro_forjas'],
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'oxi_krox', texto: 'Objetivo localizado. Profundidad: máxima.' },
          { quien: 'oxi_pip', texto: '¿Qué objetivo?' },
          { quien: 'oxi_krox', texto: 'Lo que hace temblar la montaña. Por fin algo que perseguir.' },
        ],
        narracion:
          'En el centro de la forja, la roca misma se ha puesto de pie. Los ' +
          'esbirros no fueron fabricados: la montaña los escupió cuando el ' +
          'Eternal dejó de contenerla.',
        cineEntrada: {
          texto:
            'Surgen del mismo magma. No tienen líder: solo una furia ciega ' +
            'contra el mundo que los escupió.'
        },
        cineVictoria: {
          texto:
            'Puertas de acero tras puertas de acero. Una jaula, custodiada ' +
            'antes por mecanizados que ya no se mueven. ¿Qué guardaban bajo el ' +
            'magma del volcán?'
        },
        recompensa: { personaje: 'oxi_kratox', accion: 'n_investigar' },
        textoRecompensa:
          'Kratox, el Almirante, habla antes de golpear, como siempre. Le ' +
          'explica a la montaña por qué va a apagarla.'
      },
      {
        n: 6,
        titulo: "A'tar, el fuego sin herrero",
        sangre: 8,
        // El Eternal se presenta primero y lanza desde su primer turno; los
        // esbirros le cubren (si salía el último, casi nunca llegaba a salir).
        criaturas: ['cri_atar', 'cri_esbirro_forjas', 'cri_esbirro_forjas'],
        esJefe: true,
        // BORRADOR de Claude (docs/BIBLIA.md). Sin escenario 2D, lo dicen en
        // bocadillos al empezar el duelo (ui/bocadillos.js).
        dialogo: [
          { quien: 'oxi_kratox', texto: 'Antes de proceder, explicaré los motivos.' },
          { quien: 'oxi_pip', texto: '¿A él? ¿Al Eternal?' },
          { quien: 'oxi_kratox', texto: 'A todos se les explica, Pip. Es lo que nos distingue de la escoria.' },
          { quien: 'oxi_pip', texto: 'Entonces explícale rápido.' },
        ],
        narracion:
          'A’tar, el Eternal del Caos, era la energía que movía las forjas. ' +
          'Encadenado durante años, su fuerza se desbordó: ya no da forma a ' +
          'nada, solo funde. Si no lo detienen aquí, no quedará nada sólido ' +
          'en Aether’Num.',
        cineEntrada: {
          texto:
            'En lo más hondo del volcán está A’tar, señor de las forjas. Lo ' +
            'encerraron hace mucho y lo esclavizaron: su magia del Caos era el ' +
            'fuego que derretía el metal, lo moldeaba y le daba vida. ¿Quién ' +
            'podrá calmar su cólera?'
        },
        cineVictoria: {
          texto:
            'La cuna del Caos se apaga. Y en el silencio, los Persecutores oyen' +
            ' una voz nueva que, desde lejos, les da la primera orden en ' +
            'semanas: capturar a todo aquel sobre quien haya caído la lluvia de' +
            ' los Eternos.'
        },
        recompensa: null,
        textoRecompensa: null
      }
    ]
  }
};

/** Ya no queda ninguno pendiente: los cuatro están definidos. */
window.Game.DUNGEONS_PENDIENTES = {};

/**
 * La historia secreta: se abre al reunir los cuatro cristales.
 *
 * `desbloquea` es DECLARATIVO, un registro de lo que la historia concede según
 * el guion. Los cerrojos de verdad siguen donde estaban (`State.desbloqueado()`
 * para el modo solo y el constructor), así que cambiar esta lista no mueve
 * ninguna puerta por sí sola. Está aquí para que el texto y sus consecuencias
 * vivan juntos y no se contradigan en silencio.
 */
window.Game.HISTORIA_FINAL = {
  id: 'historia_secreta',
  titulo: 'La bendición de los que piden ayuda',
  texto:
    'Los cristales de los cuatro Eternales quedaron corrompidos, pero ' +
    'en Aether’Num aún quedaba esperanza. Quedaba una ninfa capaz de ' +
    'usar la magia de la Vida con su propósito original y, junto a ' +
    'ella, un joven ingeniero capaz de construir mecanizados distintos ' +
    'de los que salen de la Forja. Quien clama por ayuda recibe la ' +
    'bendición de su Eterno; a veces, a través de alianzas que nadie ' +
    'esperaba.',
  desbloquea: {
    // Los seis mercenarios que la historia presenta.
    personajes: [
      'mer_lyla',
      'mer_tilos',
      'mer_yrving',
      'mer_yun',
      'mer_errante',
      'mer_zhin'
    ],
    modos: ['solo', 'constructor']
  }
};

window.Game.calabozoDe = function (razaId) {
  return window.Game.DUNGEONS[razaId] || null;
};

/** La gema que deja el Eternal de esa raza, o null. */
window.Game.gemaDe = function (razaId) {
  const cal = window.Game.calabozoDe(razaId);
  return (cal && cal.gema) || null;
};

/**
 * La gema pintada (su imagen, con su brillo que late y un destello que la
 * cruza). `tam` en px. La máscara del destello va EN LÍNEA: un url() dentro de
 * una variable CSS se resolvería contra la hoja y no cargaría.
 */
window.Game.gemaImg = function (gema, tam = 40) {
  if (!gema || !gema.imagen) return gema ? gema.sigil : '';
  const m = `url('${gema.imagen}')`;
  return `<span class="gema-img" style="--tam:${tam}px;--brillo:${gema.brillo || '#fff'}">` +
    `<img src="${gema.imagen}" alt="${gema.nombre}" draggable="false">` +
    `<span class="gema-destello" style="-webkit-mask-image:${m};mask-image:${m}"></span></span>`;
};

/** Las cuatro gemas, en el orden de la campaña. */
window.Game.gemasTotales = function () {
  return (window.Game.RACE_ORDER || [])
    .map((r) => ({ raza: r, gema: window.Game.gemaDe(r) }))
    .filter((g) => g.gema);
};

/**
 * Equipo desbloqueado tras superar `etapasSuperadas` etapas.
 * @returns {{personajes:string[], acciones:string[]}}
 */
window.Game.equipoDeHistoria = function (razaId, etapasSuperadas) {
  const cal = window.Game.calabozoDe(razaId);
  if (!cal) return null;

  const personajes = [...cal.personajesIniciales];
  const acciones = [...cal.accionesIniciales];

  for (let i = 0; i < etapasSuperadas && i < cal.etapas.length; i++) {
    const r = cal.etapas[i].recompensa;
    if (!r) continue;
    if (r.personaje && !personajes.includes(r.personaje)) personajes.push(r.personaje);
    if (r.accion && !acciones.includes(r.accion)) acciones.push(r.accion);
  }

  return { personajes, acciones };
};

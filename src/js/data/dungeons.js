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
    // TEXTOS PROVISIONALES: reescribir con la prosa definitiva.
    gema: {
      id: 'gema_orden',
      nombre: 'Cristal del Orden',
      sigil: '◈',
      mensaje:
        'El cristal de Üldar late todavía con la luz enferma del bosque. Así ' +
        'no sirve de nada: para limpiarlo hacen falta los otros tres.'
    },
    intro:
      'Annia acaba de ser desterrada de su pueblo por despertar poderes del ' +
      'Orden. Obligada a internarse en los bosques, descubre que la corrupción ' +
      'llegó antes que ella.',

    // Escena de entrada al calabozo, ANTES del texto dorado. Opcional: el
    // calabozo que no la tenga pasa directo a su `cinematica`.
    //
    // `conSonido` se pone según lo que traiga el archivo: esta pista está en
    // silencio digital, así que va muda y no se pierde nada. La música del
    // calabozo sigue sonando en los dos casos.
    videoIntro: { src: 'assets/video/desterrado-intro.mp4', conSonido: false },

    cinematica: {
      texto:
        'El hedor se extiende a lo lejos. El bosque que originalmente fue cuna ' +
        'de los sabios y fuente de las más profundas reflexiones, era ahora ' +
        'nada más que el escondrijo de bestias enloquecidas, bandidos y ' +
        'conspiradores. ¿Qué habrá ocurrido?'
    },

    // Las acciones con las que arrancas, antes de cualquier desbloqueo.
    accionesIniciales: ['o_finta', 'd_bloquear', 'n_ruego'],
    personajesIniciales: ['des_annia'],

    etapas: [
      {
        n: 1,
        titulo: 'Ojos en la maleza',
        criaturas: ['cri_ratas'],
        narracion:
          'La primera noche fuera de los muros, Annia aprende que el bosque ' +
          'no está vacío. Algo pequeño y numeroso la observa desde la maleza, ' +
          'y sus ojos brillan con un verde que ninguna alimaña debería tener.',
        cineEntrada: {
          texto:
            'Raras criaturas salen al encuentro de Annia, parecen haber ' +
            'perdido la cordura.'
        },
        cineVictoria: {
          texto:
            'Una magia vil se ha apoderado de las criaturas de este bosque, ' +
            'pero Annia ya no estará sola en esta travesía.'
        },
        recompensa: { personaje: 'des_axel', accion: 'o_captura' },
        textoRecompensa:
          'Axel, un muchacho que lleva semanas escondido, sale de entre los ' +
          'árboles al oír la pelea. No pregunta su nombre: solo le ofrece agua.'
      },
      {
        n: 2,
        titulo: 'El que caza de noche',
        criaturas: ['cri_ratas', 'cri_lobo'],
        narracion:
          'Las ratas no cazaban solas. Algo mayor las seguía, dejando que ' +
          'abrieran la herida antes de morder. Axel lo ve primero.',
        cineEntrada: {
          texto:
            'El peligro acecha por todos lados, pero existe la esperanza de ' +
            'encontrar a los sabios que aún habitan los bosques.'
        },
        cineVictoria: {
          texto:
            'La leyenda era cierta, los sabios están más cerca de lo que parece.'
        },
        recompensa: { personaje: 'des_thiana', accion: 'd_escape' },
        textoRecompensa:
          'Thiana los encuentra siguiendo el rastro de luz que Annia deja sin ' +
          'querer. También a ella la echaron por brillar en la oscuridad.'
      },
      {
        n: 3,
        titulo: 'La manada de los sin nombre',
        criaturas: ['cri_ratas', 'cri_lobo', 'cri_gnolls'],
        narracion:
          'Ya no son bestias sueltas: hay orden en cómo se mueven. Alguien, ' +
          'en alguna parte, les está diciendo dónde morder.',
        cineEntrada: {
          texto:
            'Los conspiradores se han apoderado de los bosques, pero se cuenta ' +
            'que, en lo más profundo del bosque, existe una esperanza. Debemos ' +
            'avanzar.'
        },
        cineVictoria: {
          texto:
            'Gnolls corruptos, siempre han sido afines con la baja moral… ' +
            '¿Pero este nivel de violencia…? Oh, Üldar… Ayúdanos.'
        },
        recompensa: { personaje: 'des_erem', accion: 'd_acrobatico' },
        textoRecompensa:
          'Erem los estaba observando desde antes de la pelea. Un anciano que ' +
          'enseña a los jóvenes a defenderse, y que ya ha visto esto antes.'
      },
      {
        n: 4,
        titulo: 'Manos humanas',
        criaturas: ['cri_gnolls', 'cri_conspiradores'],
        narracion:
          'Entre los gnolls camina algo peor: hombres. Sin magia, sin marca, ' +
          'sin corrupción en la piel. Dan órdenes, y las bestias obedecen.',
        cineEntrada: {
          texto:
            'La envidia corroe a la humanidad desde la gran lluvia de los ' +
            'eternos, y los sin magia están buscando desesperadamente medios ' +
            'para conseguir poder… qué terrible futuro nos espera.'
        },
        cineVictoria: {
          texto:
            'Hemos encontrado a los responsables, y sus ideas son ' +
            'profundamente peligrosas.'
        },
        recompensa: { personaje: 'des_lydia', accion: 'n_ocultamiento' },
        textoRecompensa:
          'Lydia reconoce los símbolos que llevan cosidos. Lleva media vida ' +
          'estudiando encantamientos y sabe leer lo que otros solo ven.'
      },
      {
        n: 5,
        titulo: 'Los que no tienen don',
        criaturas: ['cri_conspiradores'],
        narracion:
          'Sin bestias que los cubran, los conspiradores se muestran tal cual ' +
          'son. Lydia lo dice en voz alta y nadie quiere creerlo: no vinieron ' +
          'a matar al Eternal del Orden. Vinieron a corromperlo. Y lo están ' +
          'consiguiendo.',
        cineEntrada: {
          texto:
            'El eternal Üldar ya no oye la voz de su padre; sin la voz de su ' +
            'eterno, escucha a diario la voz de los conspiradores.'
        },
        cineVictoria: {
          texto:
            'Debemos ir a por el eternal, debemos recordarle que sin su magia ' +
            'del Orden, nuestro mundo caerá fácilmente.'
        },
        recompensa: { personaje: 'des_auram', accion: 'n_investigar' },
        textoRecompensa:
          'Auram llega tarde a la pelea y temprano a la verdad. Él y Erem se ' +
          'miran sin decir nada: los dos saben adónde hay que ir ahora.'
      },
      {
        n: 6,
        titulo: 'Üldar, lo que queda del Orden',
        criaturas: ['cri_esbirro_bosque', 'cri_esbirro_bosque', 'cri_uldar'],
        esJefe: true,
        narracion:
          'El Eternal del bosque sigue en pie, enorme y luminoso, y esa es la ' +
          'peor parte: todavía parece él. Los esbirros que lo rodean brotaron ' +
          'de su propia luz enferma. La banda entiende, demasiado tarde, que ' +
          'no vienen a matar a un monstruo, sino a impedir que uno nazca.',
        cineVictoria: {
          texto:
            'Üldar ha caído, pero ha dejado su cristal corrompido… si lo ' +
            'limpiamos correctamente, volverá a la vida.'
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
      mensaje:
        'El cristal de Brahma sigue caliente, como una semilla que no se ' +
        'decide a abrir. Guárdalo: solo no hará crecer nada.'
    },
    intro:
      'Sadash sigue el rastro de una luna que no debería estar menguando, y ' +
      'la encuentra colgada sobre el único lugar de Aether’Num donde aún ' +
      'crece algo. No va sola: los espíritus acompañantes se despegaron de ' +
      'la arboleda en cuanto ella se alejó de la luz de su diosa. Si el ' +
      'oasis cae, no quedará nada que refleje esa luz.',
    // Esta sí trae audio de verdad (-20 dB de media), así que suena.
    videoIntro: { src: 'assets/video/lunaria-intro.mp4', conSonido: true },

    cinematica: {
      texto:
        'Este glorioso lugar da descanso a los afligidos, lo ha hecho por ' +
        'milenios. Sin embargo, con la gran lluvia de los eternos despertó en ' +
        'los ahora empoderados lunaria, una nueva idea acerca de su antigua ' +
        'vocación.'
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
        criaturas: ['cri_centauro'],
        narracion:
          'Los centauros vigilaban el bosque del oasis desde antes de la gran ' +
          'lluvia. Ahora disparan a cualquier cosa que se mueva, y Sadash se ' +
          'mueve muy despacio.',
        cineEntrada: {
          texto:
            'Sadash, junto a sus fieles compañeros, debe reencontrarse con los ' +
            'suyos para darles un informe urgente, las criaturas de los bosques ' +
            'estaban volviéndose agresivas de pronto.'
        },
        cineVictoria: {
          texto:
            'Definitivamente algo no andaba bien, ¿Por qué los centauros se ' +
            'volverían contra los habitantes del bosque?'
        },
        recompensa: { personaje: 'lun_delem', accion: 'o_captura' },
        textoRecompensa:
          'Delem va detrás de ella sin que se lo pidan. Dice que la ' +
          'vanguardia no deja que nadie entre sola en la oscuridad.'
      },
      {
        n: 2,
        titulo: 'Bajo las raíces',
        criaturas: ['cri_centauro', 'cri_troles'],
        narracion:
          'Los troles salen de donde el bosque es más espeso. La corrupción ' +
          'les ha quitado el sueño: llevan meses despiertos y furiosos.',
        cineEntrada: {
          texto:
            'La noche siempre ha cubierto con su amable velo a todas las ' +
            'criaturas, algunos duermen, otros salen de sus madrigueras sólo de ' +
            'noche… Pero el insomnio estaba causando un severo agotamiento en ' +
            'las criaturas del bosque.'
        },
        cineVictoria: {
          texto:
            'La noche siempre ha estado relacionada con la muerte, un descanso ' +
            'para muchos, y la vigilia para otros. Algo está cambiando.'
        },
        // Única recompensa sin personaje del juego: los acompañantes ya venían
        // en el equipo desde la etapa 1, y no hay un séptimo lunaria que dar.
        recompensa: { accion: 'd_escape' },
        textoRecompensa:
          'Los espíritus se adelantan entre las raíces y le enseñan por dónde ' +
          'no pasan los troles. Nadie nuevo se suma a la banda: lo que se ' +
          'suma es una manera de salir viva.'
      },
      {
        n: 3,
        titulo: 'El claro equivocado',
        criaturas: ['cri_centauro', 'cri_troles', 'cri_culto_eclipse'],
        narracion:
          'Entre los árboles hay elfos de ojos blancos que no parpadean. ' +
          'Sadash tarda en decirlo en voz alta: son de los suyos, o lo que ' +
          'queda de un lunaria cuando la luna se le apaga del todo.',
        cineEntrada: {
          texto:
            'A lo lejos reconoces un rostro familiar, sin embargo, su mirada ' +
            'presagia algo temible.'
        },
        cineVictoria: {
          texto:
            'Lunarias están perdiendo su vínculo con la sagrada muerte, los ' +
            'guardianes del sagrado descanso ya no desean más esta cruel ' +
            'misión. Y ahora mismo desean más para sí mismas.'
        },
        recompensa: { personaje: 'lun_falum', accion: 'd_acrobatico' },
        textoRecompensa:
          'Fälum llega con el eco de muchedumbres en la voz. Donde él está, ' +
          'dicen, la diosa no anda lejos.'
      },
      {
        n: 4,
        titulo: 'El culto del eclipse',
        criaturas: ['cri_troles', 'cri_culto_eclipse'],
        narracion:
          'No vinieron a matar el oasis. Vinieron a taparlo. Sin luz, lo que ' +
          'crece deja de crecer, y lo que duerme deja de despertar.',
        cineEntrada: {
          texto:
            'Un grupo de Lunarias ha abandonado el camino del sagrado descanso. ' +
            'En sus palabras, el antiguo equilibrio no se recuperaría… para ' +
            'ellos es el momento de mover los límites de lo posible.'
        },
        cineVictoria: {
          texto:
            'La gran lluvia de los eternos movió los límites de lo imaginable, ' +
            'ahora mismo la magia corría por las venas de los mortales que, ' +
            'antaño, rendían devotamente culto a sus eternos para suplicar su ' +
            'venia, y esa magia a la vez que un mecanismo para proteger, ' +
            'también se volvió un riesgo para Aether’Num.'
        },
        recompensa: { personaje: 'lun_seluah', accion: 'o_luna_sangrienta' },
        textoRecompensa:
          'Seluah escucha lo que ninguno oye y traduce: el culto ya no manda ' +
          'aquí. Alguien lo manda a él.'
      },
      {
        n: 5,
        titulo: 'La raíz que respira',
        criaturas: ['cri_culto_eclipse', 'cri_esbirro_oasis'],
        narracion:
          'El bosque se levanta contra ellos. Los esbirros no son criaturas ' +
          'del culto: son el propio oasis defendiéndose de todo el que entra, ' +
          'sin distinguir ya entre enemigo y auxilio.',
        cineEntrada: {
          texto:
            'Un oasis que ya no provee descanso, ni final al dolor, cansancio y ' +
            'tristeza, todo permanece para siempre, nada termina.'
        },
        cineVictoria: {
          texto:
            'Las criaturas del oasis están confundidas, el eternal de la muerte ' +
            'no está haciendo su trabajo aquí. ¿Significa esto que ya nadie ' +
            'morirá? ¿Acaso existe la posibilidad de vivir para siempre?'
        },
        recompensa: { personaje: 'lun_lirhym', accion: 'n_investigar' },
        textoRecompensa:
          'Lirhym llega en persona. Que la Reina abandone el bosque alto ' +
          'significa que lo del oasis ya no es asunto de una sola arboleda.'
      },
      {
        n: 6,
        titulo: 'Brahma, el jardín que se cerró',
        criaturas: ['cri_esbirro_oasis', 'cri_esbirro_oasis', 'cri_brahma'],
        esJefe: true,
        narracion:
          'El Eternal de los oasis todavía brilla, y esa luz sigue siendo ' +
          'hermosa. Por eso cuesta tanto aceptar que lo que sostiene ya no es ' +
          'la vida del bosque, sino su encierro.',
        cineEntrada: {
          texto:
            'Es como si el tiempo no transcurriese aquí, una extraña sensación ' +
            'de permanencia… ¿esto es la inmortalidad?'
        },
        cineVictoria: {
          texto:
            'Todo lo que tiene un comienzo tiene un final, la vida termina, las ' +
            'alegrías acaban, pero también el dolor.'
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
      mensaje:
        'El cristal de Tarh Akh pesa más de lo que debería, como si trajera ' +
        'algo dentro. Que descanse ahí hasta que estén los cuatro.'
    },
    intro:
      'Luh baja a la metrópolis caída, donde algo lleva semanas impidiendo ' +
      'que los muertos descansen. Si alguien sabe lo que eso pesa, es quien ' +
      'ya volvió una vez.',

    // Audio real (-19,4 dB de media), así que suena.
    videoIntro: { src: 'assets/video/reanimado-intro.mp4', conSonido: true },

    cinematica: {
      texto:
        'La magia de la vida es un milagro asombroso, sin embargo, en las ' +
        'manos equivocadas, sobre todo de aquellos poseídos por el dolor y la ' +
        'pérdida, se sale de control fácilmente.'
    },
    accionesIniciales: ['o_finta', 'd_bloquear', 'n_ruego'],
    // Luh no baja sola: el Ejército y Gurh entran con ella desde la etapa 1 en
    // vez de ser las recompensas de la 1 y la 2. Ver las notas de esas etapas.
    personajesIniciales: ['rea_luh', 'rea_ejercito', 'rea_gurh'],

    etapas: [
      {
        n: 1,
        titulo: 'Los que no descansan',
        criaturas: ['cri_condenados'],
        narracion:
          'El agua de las alcantarillas le llega a las rodillas, y algo se ' +
          'mueve dentro. Luh reconoce el gesto: no atacan por hambre, atacan ' +
          'porque nadie les ha dado permiso para detenerse.',
        cineEntrada: {
          texto:
            '¿Por qué han vuelto a la vida?, se mueven en la búsqueda de ' +
            'explicaciones o algún propósito hacia el lugar desde donde surgen ' +
            'los sin memoria.'
        },
        cineVictoria: {
          texto:
            '¿Qué magia les habrá vuelto a levantar de esta manera tan cruel?'
        },
        // Sin personaje: el Ejército ya baja con Luh desde el principio.
        recompensa: { accion: 'o_captura' },
        textoRecompensa:
          'Nadie nuevo se suma: los que bajaron con Luh ya son los que hay. Lo ' +
          'que se aprende aquí es a agarrar al que huye.'
      },
      {
        n: 2,
        titulo: 'Lo que rezuma',
        criaturas: ['cri_condenados', 'cri_slime'],
        narracion:
          'La corrupción no solo levanta cadáveres: también los disuelve y ' +
          'los vuelve a juntar. Lo que avanza por el túnel ya no tiene forma ' +
          'de nada que haya vivido.',
        cineEntrada: {
          texto: 'Esta terrible magia sólo causa sufrimiento, pobres almas.'
        },
        cineVictoria: {
          texto:
            'Definitivamente alguien está utilizando magia de la vida para ' +
            'reanimar a la gente de este pueblo.'
        },
        // Sin personaje: Gurh también venía en el equipo de salida.
        recompensa: { accion: 'd_escape' },
        textoRecompensa:
          'Gurh, que fue la última en caer cuando arrasaron su pueblo, enseña ' +
          'lo único que le sirvió entonces: por dónde salir de un túnel que se ' +
          'cierra.'
      },
      {
        n: 3,
        titulo: 'La cripta abierta',
        criaturas: ['cri_condenados', 'cri_slime', 'cri_nigromante'],
        narracion:
          'Al fondo hay un hombre vivo dando órdenes a los muertos. No es un ' +
          'monstruo: es alguien que amó tanto que decidió no soltar. Esa es ' +
          'la parte que Luh no sabe cómo combatir.',
        cineEntrada: {
          texto:
            'En el fondo de una gran galería subterránea, recitaba sus hechizos ' +
            'quien fuera un gran orador y líder de muchedumbres. El reino caído ' +
            'sólo es un despojo de lo que fue, y este hombre ya no lograba ' +
            'distinguir la línea entre el bien y el mal.'
        },
        cineVictoria: {
          texto:
            'Un hombre desesperado está dispuesto a lo que sea para recuperar ' +
            'lo que ha perdido.'
        },
        recompensa: { personaje: 'rea_vyla', accion: 'd_acrobatico' },
        textoRecompensa:
          'Vyla, la primera de todos ellos, reconoce lo que el nigromante ' +
          'está haciendo. Lo vio una vez, en su ciudad, la noche que cayó.'
      },
      {
        n: 4,
        titulo: 'Marea de huesos',
        criaturas: ['cri_slime', 'cri_nigromante'],
        narracion:
          'El nigromante ya no finge. Cada muerto que la banda libera vuelve ' +
          'a levantarse dos túneles más allá, y la cuenta nunca baja.',
        cineEntrada: {
          texto:
            'La magia de la vida es increíble, puede extender incluso la vida ' +
            'del nigromante moribundo por las heridas de la batalla.'
        },
        cineVictoria: {
          texto:
            'Para revivir al reino, la magia del nigromante debe extenderse, ' +
            'debemos aprender a usarla todos, no sólo un hombre enamorado ' +
            'haciendo experimentos.'
        },
        recompensa: { personaje: 'rea_zabar', accion: 'n_llamada' },
        textoRecompensa:
          'Zabar llega oliendo la sangre. Su última memoria sigue grabada en ' +
          'la retina, y hoy por fin sirve de algo.'
      },
      {
        n: 5,
        titulo: 'La voz bajo la piedra',
        criaturas: ['cri_nigromante', 'cri_esbirro_catacumbas'],
        narracion:
          'De las paredes brota algo que no es carne ni piedra. El nigromante ' +
          'retrocede: tampoco él sabía qué había estado alimentando.',
        cineEntrada: {
          texto: 'Una batalla a dos bandos estaría a punto de desatarse.'
        },
        cineVictoria: {
          texto:
            'Pobre alma atormentada, el nigromante Aj’Khul, antaño consejero ' +
            'del rey, y amante de la reina, hizo hasta lo imposible para ' +
            'revivirla. Ya no queda nada de quien fue, llevó todo demasiado ' +
            'lejos.'
        },
        recompensa: { personaje: 'rea_thila', accion: 'n_investigar' },
        textoRecompensa:
          'Thila recuerda ritos que sirvió antes de la Catástrofe. Ninguno ' +
          'estaba pensado para esto, pero algunos casi encajan.'
      },
      {
        n: 6,
        titulo: 'Tarh Akh, lo que la muerte olvidó',
        criaturas: ['cri_esbirro_catacumbas', 'cri_esbirro_catacumbas', 'cri_tarh_akh'],
        esJefe: true,
        narracion:
          'El Eternal de las catacumbas sostenía la frontera entre morir y ' +
          'volver. Corrompido, la ha borrado. Darle descanso es lo único ' +
          'piadoso que queda por hacer, y también lo más difícil.',
        cineEntrada: {
          texto:
            'La magia de la vida ya no está en manos de su eterna solamente, ' +
            'ahora las criaturas de Aether’Num la utilizarían para sus propios ' +
            'fines. El eternal custodio de la vida es ahora irreconocible, ' +
            'antes fuente de fertilidad, ahora fuente de putrefacción y el ' +
            'deseo desesperado de dar vida incluso a lo que debería volver al ' +
            'polvo.'
        },
        cineVictoria: {
          texto:
            'Con el eternal caído, la magia de la vida quedaba ahora casi por ' +
            'completo en manos de los reanimados, que observando cuidadosamente ' +
            'a Aj’Khul, habrían aprendido las bases para utilizarla. Un nuevo ' +
            'imperio y ejército incansable había despertado. ¿Quién le pondría ' +
            'fin?'
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
      mensaje:
        'El cristal de A’tar no se ha apagado: dentro sigue habiendo fuego, ' +
        'esperando un yunque que todavía no tienes.'
    },
    intro:
      'Pip lleva catorce días fingiendo ser chatarra. Cuando por fin se ' +
      'levanta, descubre que la Forja de los Persecutores ya no obedece ni ' +
      'al Rey Caído.',
    // Audio real, aunque más bajo que los otros (-29,9 dB de media).
    videoIntro: { src: 'assets/video/oxitron-intro.mp4', conSonido: true },

    cinematica: {
      texto:
        'Los viejos dominios de un señor de carácter rígido y dictatorial, el ' +
        'hombre que se condenó a sí mismo a la soledad, rodeado sólo de ' +
        'mecanizados sin alma propia.'
    },
    accionesIniciales: ['o_finta', 'd_bloquear', 'n_ruego'],
    personajesIniciales: ['oxi_pip'],

    etapas: [
      {
        n: 1,
        titulo: 'Escoria viva',
        criaturas: ['cri_rocoso'],
        narracion:
          'La escoria que se acumula junto a los hornos ha empezado a abrir ' +
          'ojos. Pip calcula que si no se mueve, no lo verán. Se equivoca.',
        cineEntrada: {
          texto:
            'Luego de uno de los ahora frecuentes temblores, por entre las ' +
            'grietas del suelo, se levantó una extraña criatura ardiente.'
        },
        cineVictoria: {
          texto:
            '¿Magia del caos?, extraña cosa… Este siempre fue dominio de la ' +
            'vida y el orden.'
        },
        recompensa: { personaje: 'oxi_kaw', accion: 'o_captura' },
        textoRecompensa:
          'Kaw sale de un montón de piezas muertas y se sacude el óxido. ' +
          'Llevaba ahí desde antes que Pip, esperando lo mismo.'
      },
      {
        n: 2,
        titulo: 'Los hornos despiertos',
        criaturas: ['cri_rocoso', 'cri_guardian'],
        narracion:
          'Un guardián de lava bloquea el paso a la galería baja. Fue puesto ' +
          'ahí para proteger la forja de intrusos, y ya no distingue quién ' +
          'la construyó.',
        cineEntrada: {
          texto:
            'Definitivamente algo no anda bien, este entorno antaño sumamente ' +
            'organizado por un solo señor, ahora estaba llenándose de fuerzas ' +
            'desorganizadas que incluso lucha entre sí.'
        },
        cineVictoria: {
          texto:
            'Estas criaturas, al sentir una fuerza de otro dominio, como las ' +
            'máquinas vivientes, atacan sin piedad. Los dominios de Aether’Num ' +
            'están en conflicto.'
        },
        recompensa: { personaje: 'oxi_krag', accion: 'd_escape' },
        textoRecompensa:
          'Krag encaja los golpes que los otros no pueden. A cambio va ' +
          'dejando tuercas por el camino.'
      },
      {
        n: 3,
        titulo: 'La cadena de montaje',
        criaturas: ['cri_rocoso', 'cri_guardian', 'cri_horda'],
        narracion:
          'La forja no se ha parado: sigue fabricando. Lo que sale de la ' +
          'línea ya no son autómatas, sino cosas de roca y fuego que caminan ' +
          'como soldados.',
        cineEntrada: {
          texto:
            'Las antiguas forjas ahora son alimentadas por magia del caos, ' +
            '¿Pero cómo el caos llegó a estas tierras?'
        },
        cineVictoria: {
          texto:
            'Si esto sigue, el continente entero se llenará de este enjambre ' +
            'llameante y anárquico.'
        },
        recompensa: { personaje: 'oxi_brawl', accion: 'd_acrobatico' },
        textoRecompensa:
          'Brawl llega con el paso pesado de un capitán que ya ha perdido una ' +
          'guerra antes y no piensa perder esta.'
      },
      {
        n: 4,
        titulo: 'Horda llameante',
        criaturas: ['cri_guardian', 'cri_horda'],
        narracion:
          'Ya no salen de uno en uno. Marchan en formación, con hachas ' +
          'fundidas al brazo, hacia una salida que da directamente a los ' +
          'reinos de arriba.',
        cineEntrada: {
          texto: 'Han comenzado su avanzada, esta horda es indetenible.'
        },
        cineVictoria: {
          texto:
            'Esto es inaceptable, caos por todo lugar. Debemos frenarlos, hay ' +
            'pistas de que la fuente de este caos se encuentra en el lugar más ' +
            'profundo de las forjas.'
        },
        recompensa: { personaje: 'oxi_krox', accion: 'd_encadenar' },
        textoRecompensa:
          'Krox se oye antes de verse. El persecutor incansable ha encontrado ' +
          'por fin algo que perseguir de vuelta.'
      },
      {
        n: 5,
        titulo: 'El corazón del yunque',
        criaturas: ['cri_horda', 'cri_esbirro_forjas'],
        narracion:
          'En el centro de la forja, la roca misma se ha puesto de pie. Los ' +
          'esbirros no fueron fabricados: la montaña los escupió cuando el ' +
          'Eternal dejó de contenerla.',
        cineEntrada: {
          texto:
            'Estas criaturas surgen desde el mismísimo magma, no hay líderes, ' +
            'sólo una furia indetenible hacia el mundo que los escupió.'
        },
        cineVictoria: {
          texto:
            'Puertas de acero tras puertas de acero, una jaula antes ' +
            'custodiada por mecanizados ahora inanimados, ¿Qué habrán estado ' +
            'custodiando bajo el magma del volcán?'
        },
        recompensa: { personaje: 'oxi_kratox', accion: 'n_investigar' },
        textoRecompensa:
          'Kratox, el Almirante, habla antes de golpear, como siempre. ' +
          'Explica a la montaña por qué va a apagarla.'
      },
      {
        n: 6,
        titulo: "A'tar, el fuego sin herrero",
        criaturas: ['cri_esbirro_forjas', 'cri_esbirro_forjas', 'cri_atar'],
        esJefe: true,
        narracion:
          'El Eternal de las forjas daba forma a la materia. Corrompido, solo ' +
          'sabe fundirla. Si no lo detienen aquí, no quedará nada sólido en ' +
          'todo Aether’Num.',
        cineEntrada: {
          texto:
            'En lo más profundo del volcán, se encuentra el señor de las forjas ' +
            'A’Tar, quien encerrado por mucho tiempo fue esclavizado para usar ' +
            'su magia del caos como fuente de energía para derretir el metal, ' +
            'moldearlo y darle vida. ¿Quién podrá calmar su cólera?'
        },
        cineVictoria: {
          texto:
            'La cuna del caos se ha apagado, los soldados persecutores escuchan ' +
            'la voz de un nuevo señor, que desde la distancia les ordena ' +
            'capturar a cualquiera sobre quien haya caído parte de la gloriosa ' +
            'lluvia de los eternales.'
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
    'Aunque todos los cristales de los eternales fueron corrompidos, existía ' +
    'esperanza aún para los habitantes de Aether’Num. Quedaba una ninfa capaz ' +
    'de usar la magia de la vida con su propósito original, junto a ella un ' +
    'joven ingeniero capaz de crear mecanizados diferentes de los surgidos de ' +
    'la forja. Quien clama por ayuda, recibirá la bendición de su eterno, a ' +
    'veces, a través de alianzas insospechadas.',
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

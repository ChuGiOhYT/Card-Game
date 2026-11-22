/**
 * Historias secretas (Oscar): la recompensa de terminar la campaña principal.
 * Cada una es un calabozo corto de un mercenario SOLITARIO y su mascota, con
 * textos condensados del libro (Episodios III y IV) por Claude: los hechos son
 * de Oscar; la redacción, para que la corrija.
 *
 * Van APARTE de `DUNGEONS` a propósito: varias cuentas recorren todos los
 * calabozos (completados, el más avanzado, las gemas) y no deben contar estas.
 * `calabozoDe(id)` las encuentra igual, así que el mapa, la travesía, la mesa y
 * el progreso funcionan sin cambios.
 *
 * Cada historia se da de alta también como una «raza» oculta en `RACES`
 * (seleccionable: false), copiando el ASPECTO de una campaña (`aspecto`): su
 * fondo, sus colores, su mapa, su música, su tapete y su pantalla de carga,
 * mientras no tenga arte propio (Oscar).
 */
window.Game = window.Game || {};

window.Game.HISTORIAS_SECRETAS = {
  secreto_yrving: {
    id: 'secreto_yrving',
    protagonista: 'mer_yrving',
    mascota: 'mas_ceniza',
    aspecto: 'desterrado',
    nombreRaza: 'Yrving',
    nombre: 'Yrving · El que volvió',
    intro:
      'Un cazador huye de los Segadores con el nombre de su hija en los labios. ' +
      'Al otro lado del linde lo espera un Eternal que lleva siglos sin ver un rostro humano.',
    cinematica: {
      texto:
        'Hay un valle escondido entre montañas, un paso por debajo del mundo, donde la luz ' +
        'llega verde y dorada, como bajo el agua. Lo llaman el Bosque Sepultado. Ni los ' +
        'Segadores se atreven a cruzar su linde.'
    },
    personajesIniciales: ['mer_yrving', 'mas_ceniza'],
    accionesIniciales: ['o_finta', 'n_comodin', 'o_captura'], // Oscar: Captura es la suya
    etapas: [
      {
        n: 1,
        titulo: 'La huida',
        sangre: 5, // IA, 200 duelos, con el mazo de Oscar (Finta, Comodín, Captura): 89 %
        criaturas: ['cri_esbirro_forjas', 'cri_esbirro_forjas'],
        dialogo: [
          { quien: 'mer_yrving', texto: '¡Corre, Ceniza! Al bosque.' },
          { quien: 'mas_ceniza', texto: '(Ceniza ladra una vez, ronco, y no se separa de él.)' }
        ],
        narracion:
          'Los Segadores se llevaron a su hija. Ahora vienen por él. Yrving corre hacia el ' +
          'único bosque donde las máquinas no entran.',
        cineEntrada: {
          texto:
            'Las máquinas no se cansan. Yrving, sí. Detrás, el chirrido de los Segadores; ' +
            'delante, el linde del Bosque Sepultado. Ceniza corre a su lado, como siempre.'
        },
        cineVictoria: {
          texto:
            'Cruzan el linde y las máquinas se detienen, como si chocaran contra un muro. ' +
            'Pero las heridas ya están hechas: Yrving cae entre las raíces blancas con el ' +
            'nombre de su hija en los labios. Ceniza se tiende a su lado y ya no se mueve.'
        },
        recompensa: { accion: 'd_escape' },
        textoRecompensa: 'Huir también es una forma de seguir buscando.'
      },
      {
        n: 2,
        titulo: 'El rastro',
        sangre: 3, // 81 % (4 → 78 %). Oleada ratas + lobo: con gnolls no pasaba del 58 %
        criaturas: ['cri_ratas', 'cri_lobo'],
        dialogo: [
          { quien: 'mer_yrving', texto: 'No lo digas. No necesito que lo digas.' }
        ],
        narracion:
          'Ül Dar lo devolvió a la vida, y a Ceniza con él. Ahora recorren los caminos ' +
          'buscando el eco de una niña que ninguna magia consigue rastrear.',
        cineEntrada: {
          texto:
            '«¿Quieres volver? ¿De verdad lo quieres?» Las raíces blancas se abrieron como ' +
            'una flor invertida, y de la tierra salió un hombre que respiraba. A su lado, un ' +
            'perro se sacudía la ceniza del pelaje. —¿Dónde está mi hija? —fue lo primero que dijo.'
        },
        cineVictoria: {
          texto:
            'Semanas de rastreo, y ni un cuerpo, ni un rastro, ni un cristal roto. Es como si ' +
            'quien se llevan los Segadores dejara de existir para cualquier magia. —No está ' +
            'muerta —dice Ül Dar—. Pero no sé dónde está.'
        },
        recompensa: { accion: 'o_inmolacion' }, // Oscar: Inmolación en la última etapa
        textoRecompensa: 'Ya murió una vez. No le teme a hacerlo otra.'
      },
      {
        n: 3,
        titulo: 'El contrato',
        sangre: 10, // 95 %, ya con Inmolación
        criaturas: ['cri_condenados', 'cri_nigromante'],
        dialogo: [
          { quien: 'mer_yrving', texto: '¿Sabes a dónde los llevan?' }
        ],
        narracion:
          'Yrving se marcha de noche, sin mirar atrás. Desde entonces acepta cualquier ' +
          'contrato que huela a Segadores, a nigromantes o a la corrupción de la Vida.',
        cineEntrada: {
          texto:
            '—Tienes una segunda vida —le dijo Ül Dar—. No la desperdicies solo en venganza. ' +
            '—No es venganza —respondió él, ajustándose el arco—. Es la única búsqueda que me queda.'
        },
        cineVictoria: {
          texto:
            'El nigromante cae, y Yrving le hace la pregunta de siempre: «¿Sabes a dónde van ' +
            'los que ellos se llevan?». Nadie ha tenido nunca una respuesta que valga la pena. ' +
            'Días después, en un bosque quemado, se cruza con una figura menuda de metal con ' +
            'vetas doradas. «No cazo mercenarios», le dice. «Solo camino.» Yrving baja el arco. ' +
            'No la confianza.'
        },
        // Oscar: la mascota es el premio jugable de la historia; desde aquí
        // entra al constructor (mascotasDesbloqueadas).
        recompensa: { personaje: 'mas_ceniza' },
        textoRecompensa: 'Ceniza ya puede acompañar a cualquiera de tus equipos.'
      }
    ]
  },

  /* Lyla y Lis (Ep. III). Lyla empieza SOLA: Lis es el pájaro caído del primer
   * rito que hace con Ül Dar, y llega como recompensa de la etapa 1. */
  secreto_lyla: {
    id: 'secreto_lyla',
    protagonista: 'mer_lyla',
    mascota: 'mas_lis',
    aspecto: 'desterrado',
    nombreRaza: 'Lyla',
    nombre: 'Lyla · La que vino a aprender',
    intro:
      'Una ninfa de una estirpe más antigua que la Caída cruza los bosques buscando una leyenda: ' +
      'el lugar donde la magia de Vida aún fluye pura.',
    cinematica: {
      texto:
        'Su pueblo contaba que en algún rincón de Aeter\'num la magia de Vida aún fluía casi ' +
        'pura, guardada por un Eternal solitario. Para casi todos era leyenda, o advertencia. ' +
        'Lyla la tomó como invitación.'
    },
    personajesIniciales: ['mer_lyla'],
    accionesIniciales: ['o_finta', 'n_comodin', 'n_ruego'], // Oscar: Ruego al eterno es la suya
    etapas: [
      {
        n: 1,
        titulo: 'La invitación',
        sangre: 3, // 81 % (Lyla sola, con Finta, Comodín y Ruego)
        criaturas: ['cri_ratas'],
        dialogo: [
          { quien: 'mer_lyla', texto: 'Si la leyenda es cierta, el bosque me oirá llegar.' }
        ],
        narracion:
          'Lyla sigue el pulso de una magia limpia a través de bosques que la corrupción ya ' +
          'tocó. Lo que vive torcido no quiere que llegue.',
        cineEntrada: {
          texto:
            'Piel del color de la corteza joven, cabello de enredadera en flor, ojos de un verde ' +
            'que parece dar luz propia. Lyla no busca ser salvada, ni una causa trágica. Busca ' +
            'entender cómo se practica la Vida sin caer en su hambre.'
        },
        cineVictoria: {
          texto:
            'Ül Dar la sintió antes de verla, y temió una trampa. —Pensé que serías diferente ' +
            '—dijo ella—. Más roto. Pero tu magia no suena rota. Suena triste. Junto a las raíces ' +
            'blancas, un pájaro caído aceptó volver. Despertó entero, y ya no se apartó de ella.'
        },
        recompensa: { personaje: 'mas_lis', accion: 'n_diplomatico' },
        textoRecompensa: 'Lis: la primera vida que devolvieron juntos. Y proteger el rito también es pelear.'
      },
      {
        n: 2,
        titulo: 'El contrapeso',
        sangre: 4, // 96 % (6 → 40 %)
        criaturas: ['cri_ratas', 'cri_lobo'],
        dialogo: [
          { quien: 'mer_lyla', texto: 'Antes solo tenías una pregunta. Ahora tienen un motivo para decir que sí.' }
        ],
        narracion:
          'Lyla quiere aprender el rito. No para revivir a nadie: para entender qué impide que ' +
          'Ül Dar se convierta en lo que persigue a este mundo.',
        cineEntrada: {
          texto:
            '—La diferencia no está en mí —le advirtió Ül Dar—. Está en lo que decido cada vez ' +
            'que el hambre habla. Un día podría fallar. —Entonces estaré aquí para impedirlo ' +
            '—respondió ella—, o para llorar contigo si no puedo.'
        },
        cineVictoria: {
          texto:
            'Lyla se quedó. No como aprendiz sumisa, sino como contrapeso: donde Ül Dar dudaba, ' +
            'ella empujaba; donde él se hundía en la culpa, ella le recordaba que la culpa sin ' +
            'acción no salva a nadie. Por primera vez en siglos, el Eternal recordó una palabra: compañía.'
        },
        recompensa: { accion: 'o_inmolacion' }, // Oscar: Inmolación en la última etapa
        textoRecompensa: 'Para ser el puente, hay que estar dispuesta a arder.'
      },
      {
        n: 3,
        titulo: 'El puente',
        sangre: 7, // 92 %, ya con Inmolación
        criaturas: ['cri_esbirro_forjas', 'cri_guardian'],
        dialogo: [
          { quien: 'mer_lyla', texto: 'Aguanta. Ya casi llego.' }
        ],
        narracion:
          'Muy lejos, en las ruinas de Forjaris, una vida demasiado joven se apaga de golpe. ' +
          'Está a días de camino, y las raíces blancas no llegan tan lejos.',
        cineEntrada: {
          texto:
            'Lyla sintió esa muerte como una cuerda que se rompe: demasiado joven, demasiado ' +
            'repentina, sin ninguna resignación. —Hay muy poco tiempo —dijo—. Yo llevo la raíz ' +
            'hasta él. Hazlo a través de mí.'
        },
        cineVictoria: {
          texto:
            'Con las manos hundidas en la tierra, Lyla dejó que la magia de Ül Dar la atravesara ' +
            'como un hilo de luz dorada. —¿Quieres volver? —susurró el Eternal a través de ella. ' +
            'Sí, respondió una furia de preguntas sin responder. Tengo que entender. Y entre los ' +
            'escombros de Forjaris, Tilos abrió los ojos.'
        },
        // Oscar: la mascota es el premio jugable de la historia; desde aquí
        // entra al constructor (mascotasDesbloqueadas).
        recompensa: { personaje: 'mas_lis' },
        textoRecompensa: 'Lis ya puede acompañar a cualquiera de tus equipos.'
      }
    ]
  },

  /* Tilos y Chispa (Ep. III-IV). Que Chispa la construyera antes de morir es
   * lectura de Claude a partir de su carta («su primera creación»). */
  secreto_tilos: {
    id: 'secreto_tilos',
    protagonista: 'mer_tilos',
    mascota: 'mas_chispa',
    aspecto: 'oxitron',
    nombreRaza: 'Tilos',
    nombre: 'Tilos · El niño de Forjaris',
    intro:
      'El último constructor de Forjaris quiere entender por qué el metal que amaba su pueblo ' +
      'se volvió la peor de las cacerías.',
    cinematica: {
      texto:
        'Forjaris fue un reino de artesanos que trabajaban el engranaje con una precisión casi ' +
        'mágica. Cuando la corrupción de Vida alcanzó sus talleres, no se alzaron muertos: ' +
        'despertaron los primeros Segadores.'
    },
    personajesIniciales: ['mas_chispa', 'mer_tilos'],
    accionesIniciales: ['o_finta', 'n_comodin', 'd_biomecanica', 'd_escape'], // Oscar: Biomecánica y Escape, siempre
    etapas: [
      {
        n: 1,
        titulo: 'El último de Forjaris',
        sangre: 4, // 87 % (con Finta, Comodín y Biomecánica)
        criaturas: ['cri_rocoso', 'cri_esbirro_forjas'],
        dialogo: [
          { quien: 'mer_tilos', texto: 'Quieta, Chispa. Si nos oyen, nos cazan.' },
          { quien: 'mas_chispa', texto: '(Chispa baja las orejas de latón y apaga el núcleo de su pecho.)' }
        ],
        narracion:
          'Lo llaman «el niño» porque es el último de su estirpe. Sobrevive escondido entre las ' +
          'ruinas, aprendiendo solo los planos que su padre no alcanzó a enseñarle.',
        cineEntrada: {
          texto:
            'Tilos vio morir a su padre y a cada maestro constructor de Forjaris, algunos ' +
            'devorados por sus propias creaciones. Juró que algún día entendería por qué. ' +
            'Mientras tanto, armó a Chispa con chatarra, para no estar tan solo.'
        },
        cineVictoria: {
          texto:
            'Días sin dormir. Una tubería de presión mal calculada. La explosión de vapor y ' +
            'metralla lo dejó tendido entre los escombros de su taller, con el corazón detenido. ' +
            'Chispa no se apartó de él. Muy lejos, una ninfa sintió esa muerte como una cuerda que se rompe.'
        },
        recompensa: { accion: 'o_sabotaje' },
        textoRecompensa: 'Nadie sabe mejor cómo se rompe una máquina que quien la construye.'
      },
      {
        n: 2,
        titulo: 'El hilo dorado',
        sangre: 3, // 79 % (2 → 95 %, 4 → 50 %)
        criaturas: ['cri_ratas', 'cri_lobo'],
        dialogo: [
          { quien: 'mer_tilos', texto: 'Vida pura. Tiene que haber una forma de usarla.' }
        ],
        narracion:
          'Despertó entre los escombros, muy lejos de cualquier raíz blanca. Ahora sigue el ' +
          'rastro del hilo dorado que lo trajo de vuelta, terco como solo un constructor puede serlo.',
        cineEntrada: {
          texto:
            '«¿Quieres volver? ¿De verdad lo quieres?» Su alma dudó, no por resignación, sino por ' +
            'un trabajo sin terminar. Sí. Quiero volver. Tengo que entender. El hilo dorado se ' +
            'hundió en su pecho, y Tilos respiró de nuevo.'
        },
        cineVictoria: {
          texto:
            '—Me devolviste con Vida pura —le dijo a Ül Dar, sin preámbulos—. ¿Por qué nadie ha ' +
            'pensado en usarla así? —Porque casi nadie la tiene sin corromper. Y quienes la ' +
            'tienen no piensan en máquinas, jovenzuelo. Tilos sonrió por primera vez desde la ' +
            'muerte de su padre. —Yo sí.'
        },
        recompensa: { accion: 'o_inmolacion' }, // Oscar: Inmolación en la última etapa
        textoRecompensa: 'Lo que se construye con vida también puede entregarse entero.'
      },
      {
        n: 3,
        titulo: 'El primer Vástago',
        sangre: 6, // 86 %, ya con Inmolación
        criaturas: ['cri_rocoso', 'cri_guardian'],
        dialogo: [
          { quien: 'mer_tilos', texto: 'Mis Vástagos preguntan primero. Los suyos, nunca.' }
        ],
        narracion:
          'De vuelta en Forjaris, los primeros núcleos de Vida pura empiezan a latir. Los ' +
          'Segadores sienten algo nuevo entre las ruinas, y vienen a buscarlo.',
        cineEntrada: {
          texto:
            '—Si te equivocas —le advirtió Ül Dar—, si la línea entre preguntar y obligar se ' +
            'difumina aunque sea un poco… —Lo sé. Construiré exactamente lo contrario de lo que ' +
            'mató a mi gente, o no construiré nada en absoluto.'
        },
        cineVictoria: {
          texto:
            'Los Vástagos no son Segadores: son cuerpos de metal para las almas que dudan en el ' +
            'umbral, un lugar donde existir mientras deciden. Antes de un amanecer, una figura ' +
            'menuda con vetas doradas cruzó la puerta del taller. —Otra alma dudando —dijo Tilos—. ' +
            'Aquí nadie te va a preguntar quién fuiste. Solo qué quieres ser ahora.'
        },
        // Oscar: la mascota es el premio jugable de la historia; desde aquí
        // entra al constructor (mascotasDesbloqueadas).
        recompensa: { personaje: 'mas_chispa' },
        textoRecompensa: 'Chispa ya puede acompañar a cualquiera de tus equipos.'
      }
    ]
  }
};

/**
 * Las que aún no están escritas: se enseñan como «próximamente» en la ventana
 * de las historias secretas. Hoy, ninguna.
 */
window.Game.HISTORIAS_PROXIMAS = [];

/**
 * Mascotas ganadas: la de cada historia secreta TERMINADA. Entran en el
 * constructor (personajesDeRaza) con cualquier estirpe, como los mercenarios.
 */
window.Game.mascotasDesbloqueadas = function () {
  const G = window.Game;
  if (!G.State || !G.State.calabozoCompleto) return [];
  return Object.values(G.HISTORIAS_SECRETAS)
    .filter((h) => G.State.calabozoCompleto(h.id))
    .map((h) => h.mascota);
};

/* Alta de cada historia como raza oculta y su mapa (de su campaña de aspecto). */
(function () {
  const G = window.Game;
  for (const h of Object.values(G.HISTORIAS_SECRETAS)) {
    const base = G.RACES[h.aspecto];
    const merc = G.RACES.mercenario || {};
    G.RACES[h.id] = {
      ...base,
      id: h.id,
      nombre: h.nombreRaza,
      lema: h.nombre,
      sigil: merc.sigil || '?',
      emblema: merc.emblema,
      seleccionable: false,
      secreta: true,
      aspecto: h.aspecto
    };
    // El mapa de la campaña, con tantos nodos como etapas: el primero, el del
    // medio y el último, para que el sendero cruce el mapa entero.
    const m = G.DUNGEONS[h.aspecto] && G.DUNGEONS[h.aspecto].mapa;
    if (m && !h.mapa) {
      const k = h.etapas.length;
      const nodos = Array.from({ length: k }, (_, i) => m.nodos[Math.round((i * (m.nodos.length - 1)) / Math.max(1, k - 1))]);
      h.mapa = { ...m, nodos };
    }
    // Y su recorrido de lado, si la campaña lo tiene (el Bosque): con los
    // retratos de cuerpo entero de Oscar, el mercenario camina con su mascota.
    const esc = G.DUNGEONS[h.aspecto] && G.DUNGEONS[h.aspecto].escenario2d;
    if (esc && !h.escenario2d) h.escenario2d = esc;
  }
})();

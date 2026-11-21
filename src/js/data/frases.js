/**
 * Lo que dicen los personajes DURANTE un duelo de campaña, en un bocadillo
 * sobre su carta (`ui/bocadillos.js`). Solo texto: aquí se puede reescribir
 * todo sin tocar código. BORRADOR de Claude a partir de docs/BIBLIA.md; las
 * voces son las de la biblia (§8).
 *
 * Momentos de un personaje (cualquiera puede faltar: si falta, calla):
 *   entra     al ponerse en posición
 *   destruye  al tumbar a quien atacó
 *   cae       al ser destruido (últimas palabras)
 *   apuros    la primera vez que a su bando le queda poca sangre
 *
 * Momentos de un jefe (Eternal):
 *   aparece   la primera vez que sale a posición
 *   provoca   al empezar alguno de sus turnos
 *   herido    la primera vez que su sangre baja de la mitad
 *   cae       al ser derribado
 *
 * Cada momento es una lista: se elige una al azar sin repetir la anterior.
 * Una frase entre paréntesis se lee como acotación, no como algo dicho.
 *
 * Zhin está detrás de las ratas del Bosque, pero es un SECRETO (Oscar): aquí
 * no se nombra. Solo una acotación deja la pista.
 */
window.Game = window.Game || {};

window.Game.FRASES = {
  /* ------------------------------ Desterrados ------------------------------ */
  des_annia: {
    entra: ['Es solo luz. Mi luz.', 'No voy a esconderme más.', 'Si me ven, que me vean.'],
    destruye: ['Lo siento… tenía que hacerlo.', 'Funcionó. ¡Funcionó!'],
    cae: ['Sigan sin mí…'],
    apuros: ['La luz se apaga… aguanta, Annia.']
  },
  des_axel: {
    entra: ['Lo vi primero. Siempre lo veo primero.', 'Yo vigilo. Ustedes peleen.'],
    destruye: ['¡Ja! ¿Vieron eso?', 'Uno menos que nos siga.'],
    cae: ['Perdón… no lo vi venir.'],
    apuros: ['Son demasiados. ¡Son demasiados!']
  },
  des_thiana: {
    entra: ['Déjame mostrarte dónde golpear.', 'La luz no miente.'],
    destruye: ['Ahí estaba la grieta.', 'Te lo dije: la luz no miente.'],
    cae: ['Brillé… demasiado…'],
    apuros: ['No pienso apagarme aquí.']
  },
  des_erem: {
    entra: ['Mantente cerca.', 'Ya he visto esto antes.'],
    destruye: ['Bien.', 'Respira. Sigue.'],
    cae: ['Cuídenlos…'],
    apuros: ['No necesitamos durar para siempre. Solo lo suficiente.']
  },
  des_lydia: {
    entra: ['Conozco estos símbolos.', 'Lo que ellos esconden, yo lo leo.'],
    destruye: ['Un encantamiento menos.', 'Aprendan, jóvenes: así se deshace.'],
    cae: ['Enséñenles… la verdad…'],
    apuros: ['He vivido lo suficiente para no temer esto.']
  },
  des_auram: {
    entra: ['Detrás de mí.', 'Mi martillo está listo.'],
    destruye: ['Sonó a campana rota.', '¡Otro!'],
    cae: ['Erem… sigue tú…'],
    apuros: ['¡Que nadie toque a los chicos!']
  },

  /* -------------------------------- Lunaria -------------------------------- */
  lun_sadash: {
    entra: ['Por la luna que mengua.', 'No vine sola.'],
    destruye: ['Descansa.', 'Que la luna te guarde.'],
    cae: ['La luna… se apaga…'],
    apuros: ['Diosa, no me sueltes ahora.']
  },
  lun_acompanantes: {
    entra: ['(El lobo gruñe. El cuervo grazna hacia la niebla.)'],
    destruye: ['(El cuervo bate las alas, satisfecho.)'],
    cae: ['(Un aullido largo, y luego nada.)'],
    apuros: ['(Los espíritus se cierran en torno a los suyos.)']
  },
  lun_delem: {
    entra: ['¡La vanguardia no deja a nadie solo!', '¡A mi lado!'],
    destruye: ['Descansa… no luches más.', '¡Ahí!'],
    cae: ['Ya… puedo descansar…'],
    apuros: ['Respira. Calma. Todavía no.']
  },
  lun_falum: {
    entra: ['La diosa se acerca.', 'Escuchen: no hablo solo.'],
    destruye: ['La muchedumbre te despide.'],
    cae: ['Mil voces… callan…'],
    apuros: ['El coro no termina aquí.']
  },
  lun_seluah: {
    entra: ['Escucho lo que nadie oye.', 'La diosa habla. Yo traduzco.'],
    destruye: ['Descansa. Ya puedes descansar.', 'Ve en paz.'],
    cae: ['Por fin… silencio…'],
    apuros: ['Calma. La calma también es un arma.']
  },
  lun_lirhym: {
    entra: ['La Reina ha bajado del bosque alto.', 'Que todos oigan.'],
    destruye: ['Así termina lo que debe terminar.'],
    cae: ['Que mi voz… siga sonando…'],
    apuros: ['Ni la Reina se rinde.']
  },

  /* -------------------------------- Oxitrón -------------------------------- */
  oxi_pip: {
    entra: ['Modo juguete: desactivado.', 'Hola. No soy peligroso. Corrección: sí.'],
    destruye: ['Objetivo ejecutado.', 'Nadie sospecha de un juguete.'],
    cae: ['Error… error…'],
    apuros: ['Integridad baja. Recomendación: no morir.']
  },
  oxi_kaw: {
    entra: ['Presa marcada.', 'Ya te tengo.'],
    destruye: ['Mordida completa.'],
    cae: ['Herramientas… dañadas…'],
    apuros: ['Retirada no disponible.']
  },
  oxi_krag: {
    entra: ['Golpea. No me moveré.', '(Una tuerca cae al suelo.)'],
    destruye: ['Aplastado.'],
    cae: ['(Se desarma pieza a pieza.)'],
    apuros: ['Blindaje al límite.']
  },
  oxi_brawl: {
    entra: ['Formación. Ahora.', 'Ya perdí una guerra. Esta no.'],
    destruye: ['Así se gana.', 'Siguiente.'],
    cae: ['Otra guerra… perdida…'],
    apuros: ['¡Nadie retrocede!']
  },
  oxi_krox: {
    entra: ['Objetivo localizado.', '(Se oye el engranaje antes de verlo.)'],
    destruye: ['Persecución terminada.'],
    cae: ['Objetivo… perdido…'],
    apuros: ['No me detengo. Nunca me detengo.']
  },
  oxi_kratox: {
    entra: ['Antes de proceder, explicaré los motivos.', 'Queda usted detenido.'],
    destruye: ['Motivo de la detención: resistencia.', 'Caso cerrado.'],
    cae: ['Informe… incompleto…'],
    apuros: ['Situación irregular. Se tomará nota.']
  },

  /* ------------------------------- Reanimados ------------------------------ */
  rea_ejercito: {
    entra: ['(Cien pasos torpes, como una sola mente.)'],
    destruye: ['(Lo cubren. Ya no se levanta.)'],
    cae: ['(Se desmoronan… y algunos ya se mueven otra vez.)']
  },
  rea_luh: {
    entra: ['Yo ya volví una vez.', 'Ninguno de ustedes pidió esto.'],
    destruye: ['Descansa. Uno de los dos debería.', 'Lo siento.'],
    cae: ['Otra vez… al frío…'],
    apuros: ['La no vida también se cansa.']
  },
  rea_gurh: {
    entra: ['Fui la última en caer. Seré la última en irme.', 'Aquí me planto.'],
    destruye: ['Por mi pueblo.'],
    cae: ['Ahora sí… con ellos…'],
    apuros: ['Mi pueblo aguantó más que esto.']
  },
  rea_vyla: {
    entra: ['Me levanté entre escombros. Puedo levantarme aquí.', 'La primera en volver.'],
    destruye: ['Al Hades contigo. Allí nos ayudarás.'],
    cae: ['Volveré… siempre vuelvo…'],
    apuros: ['Mi ciudad cayó. Yo no.']
  },
  rea_zabar: {
    entra: ['Huelo tu sangre.', '(Gruñe. Solo recuerda una cosa.)'],
    destruye: ['Por ella.'],
    cae: ['Hija… mía…'],
    apuros: ['No hasta vengarla.']
  },
  rea_thila: {
    entra: ['Recuerdo este rito.', 'Serví a Solaria. A ti no.'],
    destruye: ['El rito está completo.'],
    cae: ['¿A quién… servía…?'],
    apuros: ['Mis rodillas recuerdan cómo rezar.']
  },

  /* ------------------------------ Criaturas -------------------------------- */
  // Las ratas no hablan: la acotación es la única pista de quién las manda.
  cri_ratas: {
    entra: ['(Las ratas se detienen todas a la vez, como si alguien las llamara.)']
  },
  cri_conspiradores: {
    entra: ['Ustedes recibieron la lluvia. Nosotros, nada.', 'El bosque ya no es de los sabios.'],
    destruye: ['¿Dónde está ahora tu don?'],
    cae: ['Él… nos obedecía…']
  },
  cri_culto_eclipse: {
    entra: ['La luna se apaga. Que se apague.', 'Ya no servimos al descanso.'],
    cae: ['Sin luna… por fin…']
  },
  cri_nigromante: {
    entra: ['¿Por qué dejarlos ir, si puedo traerlos de vuelta?', 'Ella volverá. Todos volverán.'],
    destruye: ['Levántate. Ahora eres mío.'],
    cae: ['Esto no termina aquí…']
  },
  cri_guardian: {
    entra: ['(Ruge como un horno que se abre.)']
  },

  /* ------------------------------- Eternales ------------------------------- */
  cri_uldar: {
    aparece: ['Intrusos en el bosque del Orden. La ley exige castigo.', 'Ellos me hablan. Ustedes no.'],
    provoca: ['Todo debe estar en su lugar. Ustedes no lo están.', 'La ley es la ley.', '¿Quién les dio permiso para brillar?'],
    herido: ['Esta luz… ¿es mía? ¿O de ellos?', 'Padre… no te oigo…'],
    cae: ['El silencio… por fin… el silencio…']
  },
  cri_brahma: {
    aparece: ['Aquí nada termina. Quédense para siempre.', 'Bienvenidos al jardín. No hay salida.'],
    provoca: ['¿Por qué tanta prisa por acabar?', 'Duerman. Pero no despierten.', 'Les ofrezco lo que nadie más: que nada termine.'],
    herido: ['¿Me están… dando un final?'],
    cae: ['Todo lo que empieza… termina…']
  },
  cri_atar: {
    aparece: ['¡CADENAS! ¡MÁS CADENAS!', 'Todo arde. Todo se funde.'],
    provoca: ['¡Nada conserva su forma ante mí!', 'Años de fuego para su rey. ¡Ahora arderán ustedes!', '¡Fundir! ¡Fundir!'],
    herido: ['¿Quién… se atreve a apagarme?'],
    cae: ['Libre… por fin… libre…']
  },
  cri_tarh_akh: {
    aparece: ['Nadie se queda dormido en mi presencia.', 'Les daré vida. Quiéranlo o no.'],
    provoca: ['¿Por qué morir, si yo puedo impedirlo?', 'Cada muerto es un hijo que me roban.', 'Levántense. Levántense todos.'],
    herido: ['Los pierdo… otra vez los pierdo…'],
    cae: ['Que descansen… ya… que descansen…']
  }
};

/**
 * La frase de cada estirpe, dicha por su protagonista al elegirla en la
 * pantalla de estirpes (ui/vocesPersonajes.js). Textos aprobados por Oscar. La voz sale
 * de tools/narrador/generar-voces.mjs (Gemini, una voz por personaje): si
 * cambias un texto, hay que regenerarla o callará (nunca suena una voz que no
 * corresponde).
 */
window.Game.FRASE_ESTIRPE = {
  desterrado: { personaje: 'des_annia', texto: 'No pedí esta luz… pero no voy a apagarla.' },
  lunaria: { personaje: 'lun_sadash', texto: 'La marea recuerda lo que la piedra olvida. Yo también.' },
  // Pip es un robot: no habla con voz, «dice» su frase en pitidos digitales
  // (ui/vocesPersonajes.js los genera; Oscar).
  oxitron: { personaje: 'oxi_pip', texto: '¿Un juguete? Eso es justo lo que quiero que crean.', robot: true },
  reanimado: { personaje: 'rea_luh', texto: 'Morir no fue lo peor. Lo peor fue volver… sin ella.' }
};

/**
 * La frase de ENTRADA de cada personaje: suena con su voz UNA vez por duelo,
 * la primera vez que se pone en posición (ui/vocesPersonajes.js), sin
 * bocadillo. Elegidas por Oscar (máx. 5 palabras). Las voces y sus efectos
 * (robot para los Oxitrón, coro, eco) están en tools/narrador/voces-personajes.json
 * y salen de GENERAR_VOCES.bat. Lo que no es voz es un `sonido` que genera el
 * juego (el cuervo de los Espíritus, la horda del Ejército).
 */
window.Game.FRASE_ENTRADA = {
  des_annia: 'Ya no me esconderé.',
  des_axel: 'Yo los vi primero.',
  des_thiana: 'Muéstrame dónde sangras.',
  des_erem: '¡Detrás de mí!',
  des_lydia: 'Te veo, jovencito.',
  des_auram: 'Forjé esto para protegerlos.',
  lun_sadash: 'Mi guardia nunca termina.',
  lun_delem: '¡Yo voy primero!',
  lun_falum: '¡Escúchanos!',
  lun_seluah: 'La diosa me envía.',
  lun_lirhym: 'Hasta el silencio me oye.',
  lun_acompanantes: { sonido: 'cuervo' },
  oxi_pip: 'Modo juguete: apagado.',
  oxi_kaw: 'Presa marcada. Caza iniciada.',
  oxi_krag: '¿Dónde está el maestro?',
  oxi_brawl: '¡Formación!',
  oxi_krox: 'Engranajes listos. Adelante.',
  oxi_kratox: 'Queda usted bajo custodia.',
  rea_luh: 'Volví. Ella no.',
  rea_vyla: 'Fui la primera en levantarme.',
  rea_gurh: 'Mi pueblo cayó. Yo no.',
  rea_zabar: 'Huelo a quien la mató.',
  rea_thila: 'Solaria me forjó. Tú no.',
  rea_ejercito: { sonido: 'horda' },
  mer_lyla: 'Por Ül Dar.',
  mer_tilos: 'La vida se abre paso.',
  mer_yrving: '¿Sabes a dónde los llevan?',
  mer_zhin: '¿Oyes los chillidos?',
  mer_yun: '¡Qué ágil!, ¿verdad?',
  mer_errante: 'Yo decido quién cruza.'
};

/**
 * Frases de las pantallas de carga (ui/pantallaCarga.js), una al azar de la
 * estirpe que toca: lore de docs/BIBLIA.md y algún consejo. BORRADOR de Claude
 * para que Oscar las corrija.
 */
window.Game.FRASES_CARGA = {
  desterrado: [
    'Annia fue desterrada por despertar el Orden. Su luz no ilumina: oculta.',
    'Los conspiradores no tienen don, pero tienen la paciencia de los envidiosos.',
    'Thiana ve las costuras de las cosas: por dónde se rompen.',
    'Erem habla poco. Cuando habla, nadie le discute.',
    'Iskar todavía cree que hace justicia. Por eso es tan peligroso.',
    'Consejo: derramar sangre te da energía, y con más energía entran personajes más caros.'
  ],
  lunaria: [
    'Los Lunaria no matan: dan descanso.',
    'Cada lunaria nace con un espíritu acompañante enviado por la diosa.',
    'En el Oasis nada termina. Ni siquiera el cansancio.',
    'La Reina Lirhym habla, y hasta los que no oyen la escuchan.',
    'Brahma era la Muerte. Ahora no deja morir a nadie.',
    'Consejo: cuando Sadash se retira de la posición, el rival sangra por cada lunaria revelado.'
  ],
  oxitron: [
    'Pip lleva catorce días fingiendo ser chatarra.',
    'Lo que los Persecutores capturan deja de existir para cualquier magia.',
    'A’tar daba forma al metal. Encadenado, ya solo funde.',
    'Kratox siempre explica los motivos antes de llevarte.',
    'El Rey Caído se condenó a la soledad. Su Forja sigue trabajando sin él.',
    'Consejo: los Oxitrón ganan aguantando. Defensa alta y paciencia.'
  ],
  reanimado: [
    'Se alzaron con la lluvia sin que nadie los llamara.',
    'Los muertos de las Catacumbas recuerdan. Por eso sufren.',
    'Luh volvió. Ella no.',
    'Tarh Akh quiere dar vida incluso a lo que debe volver al polvo.',
    'Aj’Khul no odiaba la vida: la amaba demasiado para dejarla ir.',
    'Consejo: lo que cae al Hades no se pierde del todo. Los Reanimados viven de eso.'
  ]
};

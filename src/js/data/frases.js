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

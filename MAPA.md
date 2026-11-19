# Mapa del proyecto

> **Archivo generado.** No lo edites a mano: se regenera con `npm run mapa`.
> Las convenciones y las trampas conocidas están en [CLAUDE.md](CLAUDE.md).

Generado desde `src/index.html` siguiendo el orden real de carga de los
scripts, que también es el orden de dependencias.

## Índice rápido de `window.Game`

| Símbolo | Tipo | Archivo:línea |
|---|---|---|
| `Game.ACCIONES_CALABOZO` | dato | `src/js/data/dungeons.js:39` |
| `Game.ACCIONES_CALABOZO_BASICAS` | dato | `src/js/data/dungeons.js:57` |
| `Game.accionesDeOleada` | función | `src/js/data/dungeons.js:75` |
| `Game.AccionesIA` | módulo | `src/js/core/accionesIA.js:28` |
| `Game.ACTIONS` | dato | `src/js/data/actions.js:7` |
| `Game.ACTIONS_BY_ID` | dato | `src/js/data/actions.js:185` |
| `Game.AI` | módulo | `src/js/core/ai.js:14` |
| `Game.Ambiente` | módulo | `src/js/ui/ambiente.js:21` |
| `Game.Audio` | módulo | `src/js/core/audio.js:13` |
| `Game.Bocadillos` | módulo | `src/js/ui/bocadillos.js:28` |
| `Game.calabozoDe` | función | `src/js/data/dungeons.js:1122` |
| `Game.CHARACTERS` | dato | `src/js/data/characters.js:7` |
| `Game.CHARACTERS_BY_ID` | dato | `src/js/data/characters.js:424` |
| `Game.CHARACTERS_BY_ID` | dato | `src/js/data/creatures.js:337` |
| `Game.Cinematica` | módulo | `src/js/core/cinematica.js:20` |
| `Game.Combat` | módulo | `src/js/core/combat.js:35` |
| `Game.Confirmar` | módulo | `src/js/ui/confirmar.js:19` |
| `Game.crearJugador` | función | `src/js/core/turnEngine.js:47` |
| `Game.CREATURES` | dato | `src/js/data/creatures.js:13` |
| `Game.DueloRed` | módulo | `src/js/core/dueloRed.js:27` |
| `Game.DUNGEONS` | módulo | `src/js/data/dungeons.js:81` |
| `Game.DUNGEONS_PENDIENTES` | dato | `src/js/data/dungeons.js:1086` |
| `Game.EfectosPersonaje` | módulo | `src/js/core/efectosPersonaje.js:24` |
| `Game.equipoDeHistoria` | función | `src/js/data/dungeons.js:1143` |
| `Game.esCriatura` | función | `src/js/data/creatures.js:342` |
| `Game.ETAPAS_CON_ACCIONES_BASICAS` | dato | `src/js/data/dungeons.js:60` |
| `Game.ETIQUETA_FASE` | módulo | `src/js/core/turnEngine.js:21` |
| `Game.FASES` | dato | `src/js/core/turnEngine.js:19` |
| `Game.FRASES` | módulo | `src/js/data/frases.js:27` |
| `Game.gemaDe` | función | `src/js/data/dungeons.js:1127` |
| `Game.gemasTotales` | función | `src/js/data/dungeons.js:1133` |
| `Game.Hades` | módulo | `src/js/core/hades.js:16` |
| `Game.HISTORIA_FINAL` | módulo | `src/js/data/dungeons.js:1097` |
| `Game.INICIAL_FASE` | módulo | `src/js/core/turnEngine.js:29` |
| `Game.Jefes` | módulo | `src/js/core/bossAbilities.js:29` |
| `Game.Lupa` | módulo | `src/js/core/lupa.js:11` |
| `Game.Manual` | módulo | `src/js/core/manual.js:25` |
| `Game.Mezclador` | módulo | `src/js/ui/mezclador.js:14` |
| `Game.Narrador` | módulo | `src/js/ui/narrador.js:16` |
| `Game.NOMBRE_FASE` | módulo | `src/js/core/turnEngine.js:38` |
| `Game.personajesDeRaza` | función | `src/js/data/characters.js:430` |
| `Game.Plataforma` | módulo | `src/js/plataforma.js:25` |
| `Game.RACE_ORDER` | dato | `src/js/data/races.js:117` |
| `Game.RACES` | módulo | `src/js/data/races.js:13` |
| `Game.Recordatorios` | módulo | `src/js/core/recordatorios.js:19` |
| `Game.Red` | módulo | `src/js/core/red.js:34` |
| `Game.Router` | módulo | `src/js/core/router.js:7` |
| `Game.SANGRE_TOTAL` | dato | `src/js/core/turnEngine.js:18` |
| `Game.Screens` | dato | `src/js/screens/mainMenu.js:3` |
| `Game.Screens` | dato | `src/js/screens/raceSelect.js:2` |
| `Game.Screens` | dato | `src/js/screens/storyMode.js:2` |
| `Game.Screens` | dato | `src/js/screens/soloMode.js:2` |
| `Game.Screens` | dato | `src/js/screens/teamBuilder.js:2` |
| `Game.Screens` | dato | `src/js/screens/match.js:2` |
| `Game.Screens` | dato | `src/js/screens/remoto.js:2` |
| `Game.Sincro` | módulo | `src/js/core/sincro.js:21` |
| `Game.State` | módulo | `src/js/core/state.js:7` |
| `Game.Team` | módulo | `src/js/core/team.js:9` |
| `Game.TIPOS_ACCION` | dato | `src/js/data/actions.js:190` |
| `Game.Travesia` | módulo | `src/js/ui/travesia.js:19` |
| `Game.TurnEngine` | clase | `src/js/core/turnEngine.js:92` |
| `Game.Tutorial` | módulo | `src/js/core/tutorial.js:26` |
| `Game.Voces` | módulo | `src/js/ui/voces.js:15` |

## Datos

Contenido del juego. Los `-source.json` mandan sobre los `.js` generados.

### `src/js/data/races.js`  ·  118 líneas

Expone: `Game.RACES`, `Game.RACE_ORDER`

### `src/js/data/characters.js`  ·  435 líneas

Expone: `Game.CHARACTERS`, `Game.CHARACTERS_BY_ID`, `Game.personajesDeRaza`

Registros: CHARACTERS: 30

| Función | Línea |
|---|---|
| `personajesDeRaza()` | 430 |

### `src/js/data/actions.js`  ·  191 líneas

Expone: `Game.ACTIONS`, `Game.ACTIONS_BY_ID`, `Game.TIPOS_ACCION`

Registros: ACTIONS: 19

### `src/js/data/creatures.js`  ·  346 líneas

Expone: `Game.CREATURES`, `Game.CHARACTERS_BY_ID`, `Game.esCriatura`

Registros: CREATURES: 21

| Función | Línea |
|---|---|
| `esCriatura()` | 342 |

### `src/js/data/dungeons.js`  ·  1159 líneas

Expone: `Game.ACCIONES_CALABOZO`, `Game.ACCIONES_CALABOZO_BASICAS`, `Game.ETAPAS_CON_ACCIONES_BASICAS`, `Game.accionesDeOleada`, `Game.DUNGEONS`, `Game.DUNGEONS_PENDIENTES`, `Game.HISTORIA_FINAL`, `Game.calabozoDe`, `Game.gemaDe`, `Game.gemasTotales`, `Game.equipoDeHistoria`

| Función | Línea |
|---|---|
| `accionesDeOleada()` | 75 |
| `calabozoDe()` | 1122 |
| `gemaDe()` | 1127 |
| `gemasTotales()` | 1133 |
| `equipoDeHistoria()` | 1143 |

### `src/js/data/frases.js`  ·  228 líneas

Expone: `Game.FRASES`

## Núcleo

Reglas y estado. No tocan el DOM.

### `src/js/core/state.js`  ·  292 líneas

Expone: `Game.State`

| Función | Línea |
|---|---|
| `State.cargar()` | 51 |
| `State.guardar()` | 65 |
| `State.progresoDe(…)` | 75 |
| `State.etapasCompletadas()` | 80 |
| `State.calabozoCompleto(…)` | 88 |
| `State.calabozosCompletados()` | 94 |
| `State.calabozoDisponible(…)` | 104 |
| `State.requisitoDe(…)` | 112 |
| `State.mejorAvance()` | 128 |
| `State.desbloqueado()` | 154 |
| `State.marcarProgreso(…)` | 158 |
| `State.tieneGema(…)` | 172 |
| `State.otorgarGema(…)` | 177 |
| `State.gemas()` | 187 |
| `State.sincronizarGemas()` | 197 |
| `State.historiaFinalDesbloqueada()` | 211 |
| `State.historiaFinalVista()` | 216 |
| `State.recompensaFinalRecibida()` | 225 |
| `State.mercenariosDisponibles()` | 230 |
| `State.marcarHistoriaFinalVista()` | 234 |
| `State.recompensaPorAnunciar()` | 244 |
| `State.marcarRecompensaAnunciada()` | 248 |
| `State.hayAventuraQueReiniciar()` | 257 |
| `State.reiniciarAventura()` | 278 |

### `src/js/core/router.js`  ·  121 líneas

Expone: `Game.Router`

| Función | Línea |
|---|---|
| `Router.registrar(…)` | 13 |
| `Router.iniciar(…)` | 17 |
| `Router.ir(…)` | 25 |
| `Router.renderSeguro(…)` | 82 |
| `Router.volver()` | 103 |

### `src/js/core/team.js`  ·  115 líneas

Expone: `Game.Team`

| Función | Línea |
|---|---|
| `Team.validar(…)` | 14 |
| `Team.equipoPredeterminado(…)` | 86 |

### `src/js/core/hades.js`  ·  73 líneas

Expone: `Game.Hades`

| Función | Línea |
|---|---|
| `Hades.cartas(…)` | 18 |
| `Hades.contar(…)` | 27 |
| `Hades.ataqueTotal(…)` | 32 |
| `Hades.defensaTotal(…)` | 40 |
| `Hades.contiene(…)` | 48 |
| `Hades.recuperables(…)` | 56 |
| `Hades.resumen(…)` | 64 |

### `src/js/core/manual.js`  ·  268 líneas

Expone: `Game.Manual`

| Función | Línea |
|---|---|
| `Manual.modificar(…)` | 32 |
| `Manual.duplicar(…)` | 48 |
| `Manual.limpiarModificadores(…)` | 55 |
| `Manual.dado(…)` | 72 |
| `Manual.revelar(…)` | 143 |
| `Manual.ocultar(…)` | 153 |
| `Manual.nombreCarta(…)` | 163 |
| `Manual.bloquear(…)` | 177 |
| `Manual.estaBloqueada(…)` | 192 |
| `Manual.bloquearMientras(…)` | 201 |
| `Manual.liberar(…)` | 206 |
| `Manual.negarAcciones(…)` | 221 |
| `Manual.anularAtaque(…)` | 229 |
| `Manual.retirarDePosicion(…)` | 243 |
| `Manual.forzarPosicion(…)` | 252 |

### `src/js/core/lupa.js`  ·  81 líneas

Expone: `Game.Lupa`

| Función | Línea |
|---|---|
| `Lupa.conectar(…)` | 18 |
| `Lupa.mostrar(…)` | 45 |
| `Lupa.ampliar(…)` | 53 |
| `Lupa.cerrar()` | 76 |

### `src/js/core/audio.js`  ·  218 líneas

Expone: `Game.Audio`

| Función | Línea |
|---|---|
| `Audio.precargar()` | 75 |
| `Audio.cargarNiveles()` | 91 |
| `Audio.nivel(…)` | 101 |
| `Audio.ponerNivel(…)` | 111 |
| `Audio.aplicarNiveles()` | 123 |
| `Audio.volumenDe(…)` | 130 |
| `Audio.reproducir(…)` | 139 |
| `Audio.ponerMusica(…)` | 158 |
| `Audio._arrancar(…)` | 178 |
| `Audio.quitarMusica(…)` | 198 |

### `src/js/core/cinematica.js`  ·  319 líneas

Expone: `Game.Cinematica`

| Función | Línea |
|---|---|
| `Cinematica.duracionPara(…)` | 49 |
| `Cinematica.enCurso()` | 66 |
| `Cinematica.cortar()` | 74 |
| `Cinematica.mostrarUnaVez(…)` | 82 |
| `Cinematica.videoUnaVez(…)` | 92 |
| `Cinematica.video(…)` | 115 |
| `Cinematica.mostrar(…)` | 238 |

### `src/js/core/tutorial.js`  ·  483 líneas

Expone: `Game.Tutorial`

| Función | Línea |
|---|---|
| `Tutorial.esMiTurno(…)` | 322 |
| `Tutorial.vistos()` | 326 |
| `Tutorial.procede(…)` | 333 |
| `Tutorial.toca(…)` | 344 |
| `Tutorial.progresoTour()` | 355 |
| `Tutorial.revisar(…)` | 367 |
| `Tutorial.mostrar(…)` | 391 |
| `Tutorial.colocar(…)` | 450 |
| `Tutorial.limpiar()` | 468 |
| `Tutorial.reiniciar()` | 476 |

### `src/js/core/recordatorios.js`  ·  266 líneas

Expone: `Game.Recordatorios`

| Función | Línea |
|---|---|
| `Recordatorios.reiniciar()` | 113 |
| `Recordatorios.humano(…)` | 121 |
| `Recordatorios.observar(…)` | 133 |
| `Recordatorios.olvidar(…)` | 166 |
| `Recordatorios.pendientes(…)` | 178 |
| `Recordatorios.descartar(…)` | 248 |
| `Recordatorios.marcarVisto(…)` | 253 |
| `Recordatorios.yaVisto(…)` | 257 |
| `Recordatorios.uidsConPendientes(…)` | 262 |

### `src/js/core/combat.js`  ·  211 líneas

Expone: `Game.Combat`

| Función | Línea |
|---|---|
| `Combat._accion(…)` | 40 |
| `Combat.ataqueEfectivo(…)` | 49 |
| `Combat.defensaEfectiva(…)` | 59 |
| `Combat.postura(…)` | 68 |
| `Combat.puedeAtacar(…)` | 74 |
| `Combat.resolver(…)` | 82 |
| `Combat.resolverValor(…)` | 96 |

### `src/js/core/bossAbilities.js`  ·  368 líneas

Expone: `Game.Jefes`

| Función | Línea |
|---|---|
| `Jefes.lanzar(…)` | 47 |
| `Jefes._rival(…)` | 73 |
| `Jefes._duenoDe(…)` | 77 |
| `Jefes._personajesRival(…)` | 84 |
| `Jefes._modificarTemporal(…)` | 93 |
| `Jefes._golpeAlGrupo(…)` | 112 |

### `src/js/core/accionesIA.js`  ·  708 líneas

Expone: `Game.AccionesIA`

| Función | Línea |
|---|---|
| `AccionesIA._meAtacan(…)` | 497 |
| `AccionesIA._cambiar(…)` | 505 |
| `AccionesIA.sabeUsar(…)` | 527 |
| `AccionesIA.aplicar(…)` | 539 |
| `AccionesIA._q()` | 612 |
| `AccionesIA.aplicarManual(…)` | 627 |
| `AccionesIA.momentoDe(…)` | 635 |
| `AccionesIA.alEquipar(…)` | 642 |
| `AccionesIA.alAtacar(…)` | 652 |
| `AccionesIA.alSerAtacada(…)` | 661 |
| `AccionesIA.cobrarAutodestrucciones(…)` | 669 |
| `AccionesIA._temporal(…)` | 688 |

### `src/js/core/efectosPersonaje.js`  ·  873 líneas

Expone: `Game.EfectosPersonaje`

| Función | Línea |
|---|---|
| `EfectosPersonaje.reveladas(…)` | 166 |
| `EfectosPersonaje.reanimadosEnHades(…)` | 188 |
| `EfectosPersonaje._aActivo(…)` | 196 |
| `EfectosPersonaje.recalcularPasivos(…)` | 208 |
| `EfectosPersonaje.sabeUsar(…)` | 254 |
| `EfectosPersonaje.alDesplegar(…)` | 260 |
| `EfectosPersonaje._seluah(…)` | 271 |
| `EfectosPersonaje._opcionesOcultas(…)` | 568 |
| `EfectosPersonaje._iaObjetivo(…)` | 577 |
| `EfectosPersonaje.saboteado(…)` | 585 |
| `EfectosPersonaje.tieneYun(…)` | 592 |
| `EfectosPersonaje.alRetirarse(…)` | 602 |
| `EfectosPersonaje.zhinDe(…)` | 616 |
| `EfectosPersonaje.antesDeDestruir(…)` | 627 |
| `EfectosPersonaje.alFinDeTurno(…)` | 643 |
| `EfectosPersonaje._tilos(…)` | 676 |
| `EfectosPersonaje.negado(…)` | 707 |
| `EfectosPersonaje._modal(…)` | 717 |
| `EfectosPersonaje.iaModal(…)` | 741 |
| `EfectosPersonaje.ocultasDe(…)` | 747 |
| `EfectosPersonaje._revelarOcultas(…)` | 765 |
| `EfectosPersonaje.alEquipar(…)` | 798 |
| `EfectosPersonaje.alEntrarEnAccion(…)` | 821 |
| `EfectosPersonaje.enBatalla(…)` | 832 |
| `EfectosPersonaje._sumar(…)` | 853 |

### `src/js/core/turnEngine.js`  ·  1044 líneas

Expone: `Game.SANGRE_TOTAL`, `Game.FASES`, `Game.ETIQUETA_FASE`, `Game.INICIAL_FASE`, `Game.NOMBRE_FASE`, `Game.crearJugador`, `Game.TurnEngine`

| Función | Línea |
|---|---|
| `crearJugador()` | 47 |
| `TurnEngine.constructor(…)` | 93 |
| `TurnEngine.jugadorActivo()` | 135 |
| `TurnEngine.jugadorInactivo()` | 139 |
| `TurnEngine.vidaDe(…)` | 143 |
| `TurnEngine.energiaDe(…)` | 147 |
| `TurnEngine.activoDe(…)` | 152 |
| `TurnEngine.instancia(…)` | 156 |
| `TurnEngine.log(…)` | 166 |
| `TurnEngine.notificar()` | 170 |
| `TurnEngine.elegir(…)` | 186 |
| `TurnEngine.resolverEleccion(…)` | 214 |
| `TurnEngine.ponerEstado(…)` | 223 |
| `TurnEngine.tieneEstado(…)` | 237 |
| `TurnEngine.estadosDe(…)` | 248 |
| `TurnEngine.puedeSerAtacado(…)` | 254 |
| `TurnEngine.anunciar(…)` | 259 |
| `TurnEngine.iniciar()` | 268 |
| `TurnEngine.estaAturdido(…)` | 276 |
| `TurnEngine.eternalProtegido(…)` | 296 |
| `TurnEngine.esbirrosVivos(…)` | 304 |
| `TurnEngine.defensorEfectivo(…)` | 319 |
| `TurnEngine.interponerEsbirro(…)` | 332 |
| `TurnEngine.derramar(…)` | 364 |
| `TurnEngine.pagar(…)` | 378 |
| `TurnEngine.recuperar(…)` | 391 |
| `TurnEngine.revelar(…)` | 406 |
| `TurnEngine.enviarAlHades(…)` | 410 |
| `TurnEngine.destruir(…)` | 448 |
| `TurnEngine.recuperarDelHades(…)` | 455 |
| `TurnEngine.enviarAlVacio(…)` | 487 |
| `TurnEngine.recuperarDelVacio(…)` | 502 |
| `TurnEngine.puedeDesplegar(…)` | 518 |
| `TurnEngine.retirar(…)` | 526 |
| `TurnEngine.desplegar(…)` | 546 |
| `TurnEngine.accionesDisponibles(…)` | 585 |
| `TurnEngine.equipar(…)` | 607 |
| `TurnEngine.atacantesDisponibles(…)` | 652 |
| `TurnEngine.puedeAtacar()` | 666 |
| `TurnEngine.declararAtaque(…)` | 682 |
| `TurnEngine.implicadosAtaque()` | 740 |
| `TurnEngine.previsionAtaque()` | 755 |
| `TurnEngine.cancelarAtaque()` | 762 |
| `TurnEngine.resolverAtaque()` | 771 |
| `TurnEngine._cobrarGolpe(…)` | 812 |
| `TurnEngine.atacar(…)` | 890 |
| `TurnEngine.siguienteFase()` | 897 |
| `TurnEngine.finalizarTurno()` | 923 |
| `TurnEngine.sinPersonajes(…)` | 1010 |
| `TurnEngine.comprobarFin()` | 1018 |

### `src/js/core/ai.js`  ·  492 líneas

Expone: `Game.AI`

| Función | Línea |
|---|---|
| `AI.jugarTurno(…)` | 80 |
| `AI.jugarFase(…)` | 99 |
| `AI.valor(…)` | 188 |
| `AI.valorEnCampo(…)` | 204 |
| `AI.ataqueEnCampo(…)` | 239 |
| `AI.candidatos(…)` | 272 |
| `AI.relevarSiConviene(…)` | 288 |
| `AI.superaA(…)` | 321 |
| `AI.elegirObjetivo(…)` | 333 |
| `AI.puntuarAccion(…)` | 376 |
| `AI.elegirAccion(…)` | 423 |

### `src/js/core/red.js`  ·  508 líneas

Expone: `Game.Red`

| Función | Línea |
|---|---|
| `Red.on(…)` | 64 |
| `Red._emitir(…)` | 69 |
| `Red._poner(…)` | 75 |
| `Red.conectado()` | 81 |
| `Red.ponerRele(…)` | 84 |
| `Red._iceServers()` | 88 |
| `Red.textoSinDirecto()` | 97 |
| `Red.nuevoCodigo()` | 106 |
| `Red.normalizar(…)` | 115 |
| `Red.mostrarCodigo(…)` | 120 |
| `Red.crearSala(…)` | 124 |
| `Red.unirse(…)` | 133 |
| `Red._abrirSenal(…)` | 153 |
| `Red._carga(…)` | 190 |
| `Red._aSenal(…)` | 196 |
| `Red._cerrarSenal()` | 200 |
| `Red._deSenal(…)` | 207 |
| `Red._nuevaPc(…)` | 273 |
| `Red._ofrecer()` | 293 |
| `Red._vaciarColaIce()` | 305 |
| `Red._recibirOferta(…)` | 309 |
| `Red._recibirRespuesta(…)` | 330 |
| `Red._enganchar(…)` | 342 |
| `Red._deCanal(…)` | 381 |
| `Red._enviarInterno(…)` | 408 |
| `Red.enviar(…)` | 417 |
| `Red._perdida()` | 424 |
| `Red._volverASenal()` | 442 |
| `Red._reintentar()` | 448 |
| `Red._soltarCanal()` | 456 |
| `Red._fallar(…)` | 467 |
| `Red._soltar()` | 472 |
| `Red.cerrar(…)` | 483 |

### `src/js/core/sincro.js`  ·  182 líneas

Expone: `Game.Sincro`

| Función | Línea |
|---|---|
| `Sincro.aGrafo(…)` | 29 |
| `Sincro.deGrafo(…)` | 54 |
| `Sincro.foto(…)` | 93 |
| `Sincro.vistaPara(…)` | 109 |
| `Sincro.aplicar(…)` | 160 |

### `src/js/core/dueloRed.js`  ·  312 líneas

Expone: `Game.DueloRed`

| Función | Línea |
|---|---|
| `DueloRed.anfitrion(…)` | 42 |
| `DueloRed._argumento(…)` | 82 |
| `DueloRed.ejecutar(…)` | 97 |
| `DueloRed._prototipoEspejo()` | 265 |

## Pantallas

Una por archivo. Reciben `(contenedor, params)` y pintan.

### `src/js/screens/mainMenu.js`  ·  310 líneas

Expone: `Game.Screens`

### `src/js/screens/raceSelect.js`  ·  354 líneas

Expone: `Game.Screens`

### `src/js/screens/storyMode.js`  ·  464 líneas

Expone: `Game.Screens`

### `src/js/screens/soloMode.js`  ·  130 líneas

Expone: `Game.Screens`

### `src/js/screens/teamBuilder.js`  ·  327 líneas

Expone: `Game.Screens`

### `src/js/screens/match.js`  ·  3210 líneas

Expone: `Game.Screens`

### `src/js/screens/remoto.js`  ·  354 líneas

Expone: `Game.Screens`

## Arranque

### `src/js/plataforma.js`  ·  129 líneas

Expone: `Game.Plataforma`

| Función | Línea |
|---|---|
| `Plataforma.esMovil()` | 31 |
| `Plataforma.plugin(…)` | 35 |
| `Plataforma.anchoDeDiseno()` | 40 |
| `Plataforma.ajustarPantalla()` | 46 |
| `Plataforma.apiMovil()` | 58 |
| `Plataforma.conectarAtras()` | 94 |
| `Plataforma.iniciar()` | 120 |

### `src/js/ui/ambiente.js`  ·  115 líneas

Expone: `Game.Ambiente`

| Función | Línea |
|---|---|
| `Ambiente.html(…)` | 29 |
| `Ambiente.aplicar(…)` | 56 |
| `Ambiente.asegurar(…)` | 98 |
| `Ambiente.conectar(…)` | 110 |

### `src/js/ui/mezclador.js`  ·  148 líneas

Expone: `Game.Mezclador`

| Función | Línea |
|---|---|
| `Mezclador.abierto()` | 17 |
| `Mezclador.alternar()` | 21 |
| `Mezclador.abrir()` | 26 |
| `Mezclador.refrescar()` | 128 |
| `Mezclador.cerrar()` | 138 |

### `src/js/ui/confirmar.js`  ·  93 líneas

Expone: `Game.Confirmar`

| Función | Línea |
|---|---|
| `Confirmar.preguntar(…)` | 26 |
| `Confirmar.cerrar(…)` | 84 |

### `src/js/ui/travesia.js`  ·  167 líneas

Expone: `Game.Travesia`

| Función | Línea |
|---|---|
| `Travesia.recorrer(…)` | 39 |

### `src/js/ui/escenario2d.js`  ·  562 líneas

### `src/js/ui/temas2d.js`  ·  539 líneas

### `src/js/ui/voces.js`  ·  78 líneas

Expone: `Game.Voces`

| Función | Línea |
|---|---|
| `Voces.contexto()` | 24 |
| `Voces.tono(…)` | 33 |
| `Voces.pitar(…)` | 41 |
| `Voces.letra(…)` | 67 |
| `Voces.nuevaFrase()` | 74 |

### `src/js/ui/bocadillos.js`  ·  307 líneas

Expone: `Game.Bocadillos`

| Función | Línea |
|---|---|
| `Bocadillos.iniciar(…)` | 42 |
| `Bocadillos.parar()` | 51 |
| `Bocadillos.activo()` | 62 |
| `Bocadillos.revisar(…)` | 68 |
| `Bocadillos.trasGolpe(…)` | 108 |
| `Bocadillos.revisarSangre(…)` | 124 |
| `Bocadillos.conversacionInicial(…)` | 144 |
| `Bocadillos.frases(…)` | 164 |
| `Bocadillos.esJefe(…)` | 169 |
| `Bocadillos.jefeEnPosicion(…)` | 173 |
| `Bocadillos.nombre(…)` | 177 |
| `Bocadillos.elegir(…)` | 184 |
| `Bocadillos.decir(…)` | 195 |
| `Bocadillos.encolar(…)` | 204 |
| `Bocadillos.siguiente()` | 210 |
| `Bocadillos.ancla(…)` | 235 |
| `Bocadillos.pintar(…)` | 243 |
| `Bocadillos.escribir(…)` | 285 |

### `src/js/ui/narrador.js`  ·  89 líneas

Expone: `Game.Narrador`

| Función | Línea |
|---|---|
| `Narrador.modo()` | 23 |
| `Narrador.ponerModo(…)` | 28 |
| `Narrador.clave(…)` | 35 |
| `Narrador.pista(…)` | 46 |
| `Narrador.leer(…)` | 54 |
| `Narrador.parar(…)` | 69 |

### `src/js/app.js`  ·  38 líneas

---

Regenerado: `npm run mapa`

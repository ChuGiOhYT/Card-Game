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
| `Game.AccionesIA` | módulo | `src/js/core/accionesIA.js:27` |
| `Game.ACTIONS` | dato | `src/js/data/actions.js:7` |
| `Game.ACTIONS_BY_ID` | dato | `src/js/data/actions.js:185` |
| `Game.AI` | módulo | `src/js/core/ai.js:14` |
| `Game.Ambiente` | módulo | `src/js/ui/ambiente.js:21` |
| `Game.Audio` | módulo | `src/js/core/audio.js:13` |
| `Game.calabozoDe` | función | `src/js/data/dungeons.js:910` |
| `Game.CHARACTERS` | dato | `src/js/data/characters.js:7` |
| `Game.CHARACTERS_BY_ID` | dato | `src/js/data/characters.js:424` |
| `Game.CHARACTERS_BY_ID` | dato | `src/js/data/creatures.js:337` |
| `Game.Cinematica` | módulo | `src/js/core/cinematica.js:20` |
| `Game.Combat` | módulo | `src/js/core/combat.js:35` |
| `Game.Confirmar` | módulo | `src/js/ui/confirmar.js:19` |
| `Game.crearJugador` | función | `src/js/core/turnEngine.js:47` |
| `Game.CREATURES` | dato | `src/js/data/creatures.js:13` |
| `Game.DUNGEONS` | módulo | `src/js/data/dungeons.js:81` |
| `Game.DUNGEONS_PENDIENTES` | dato | `src/js/data/dungeons.js:875` |
| `Game.equipoDeHistoria` | función | `src/js/data/dungeons.js:931` |
| `Game.esCriatura` | función | `src/js/data/creatures.js:342` |
| `Game.ETAPAS_CON_ACCIONES_BASICAS` | dato | `src/js/data/dungeons.js:60` |
| `Game.ETIQUETA_FASE` | módulo | `src/js/core/turnEngine.js:21` |
| `Game.FASES` | dato | `src/js/core/turnEngine.js:19` |
| `Game.gemaDe` | función | `src/js/data/dungeons.js:915` |
| `Game.gemasTotales` | función | `src/js/data/dungeons.js:921` |
| `Game.Hades` | módulo | `src/js/core/hades.js:16` |
| `Game.HISTORIA_FINAL` | módulo | `src/js/data/dungeons.js:886` |
| `Game.INICIAL_FASE` | módulo | `src/js/core/turnEngine.js:29` |
| `Game.Jefes` | módulo | `src/js/core/bossAbilities.js:29` |
| `Game.Lupa` | módulo | `src/js/core/lupa.js:11` |
| `Game.Manual` | módulo | `src/js/core/manual.js:25` |
| `Game.Mezclador` | módulo | `src/js/ui/mezclador.js:14` |
| `Game.NOMBRE_FASE` | módulo | `src/js/core/turnEngine.js:38` |
| `Game.personajesDeRaza` | función | `src/js/data/characters.js:430` |
| `Game.RACE_ORDER` | dato | `src/js/data/races.js:117` |
| `Game.RACES` | módulo | `src/js/data/races.js:13` |
| `Game.Recordatorios` | módulo | `src/js/core/recordatorios.js:19` |
| `Game.Router` | módulo | `src/js/core/router.js:7` |
| `Game.SANGRE_TOTAL` | dato | `src/js/core/turnEngine.js:18` |
| `Game.Screens` | dato | `src/js/screens/mainMenu.js:3` |
| `Game.Screens` | dato | `src/js/screens/raceSelect.js:2` |
| `Game.Screens` | dato | `src/js/screens/storyMode.js:2` |
| `Game.Screens` | dato | `src/js/screens/soloMode.js:2` |
| `Game.Screens` | dato | `src/js/screens/teamBuilder.js:2` |
| `Game.Screens` | dato | `src/js/screens/match.js:2` |
| `Game.State` | módulo | `src/js/core/state.js:7` |
| `Game.Team` | módulo | `src/js/core/team.js:9` |
| `Game.TIPOS_ACCION` | dato | `src/js/data/actions.js:190` |
| `Game.TurnEngine` | clase | `src/js/core/turnEngine.js:88` |
| `Game.Tutorial` | módulo | `src/js/core/tutorial.js:26` |

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

### `src/js/data/dungeons.js`  ·  947 líneas

Expone: `Game.ACCIONES_CALABOZO`, `Game.ACCIONES_CALABOZO_BASICAS`, `Game.ETAPAS_CON_ACCIONES_BASICAS`, `Game.accionesDeOleada`, `Game.DUNGEONS`, `Game.DUNGEONS_PENDIENTES`, `Game.HISTORIA_FINAL`, `Game.calabozoDe`, `Game.gemaDe`, `Game.gemasTotales`, `Game.equipoDeHistoria`

| Función | Línea |
|---|---|
| `accionesDeOleada()` | 75 |
| `calabozoDe()` | 910 |
| `gemaDe()` | 915 |
| `gemasTotales()` | 921 |
| `equipoDeHistoria()` | 931 |

## Núcleo

Reglas y estado. No tocan el DOM.

### `src/js/core/state.js`  ·  289 líneas

Expone: `Game.State`

| Función | Línea |
|---|---|
| `State.cargar()` | 48 |
| `State.guardar()` | 62 |
| `State.progresoDe(…)` | 72 |
| `State.etapasCompletadas()` | 77 |
| `State.calabozoCompleto(…)` | 85 |
| `State.calabozosCompletados()` | 91 |
| `State.calabozoDisponible(…)` | 101 |
| `State.requisitoDe(…)` | 109 |
| `State.mejorAvance()` | 125 |
| `State.desbloqueado()` | 151 |
| `State.marcarProgreso(…)` | 155 |
| `State.tieneGema(…)` | 169 |
| `State.otorgarGema(…)` | 174 |
| `State.gemas()` | 184 |
| `State.sincronizarGemas()` | 194 |
| `State.historiaFinalDesbloqueada()` | 208 |
| `State.historiaFinalVista()` | 213 |
| `State.recompensaFinalRecibida()` | 222 |
| `State.mercenariosDisponibles()` | 227 |
| `State.marcarHistoriaFinalVista()` | 231 |
| `State.recompensaPorAnunciar()` | 241 |
| `State.marcarRecompensaAnunciada()` | 245 |
| `State.hayAventuraQueReiniciar()` | 254 |
| `State.reiniciarAventura()` | 275 |

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

### `src/js/core/manual.js`  ·  203 líneas

Expone: `Game.Manual`

| Función | Línea |
|---|---|
| `Manual.modificar(…)` | 32 |
| `Manual.duplicar(…)` | 48 |
| `Manual.limpiarModificadores(…)` | 55 |
| `Manual.dado(…)` | 72 |
| `Manual.revelar(…)` | 87 |
| `Manual.ocultar(…)` | 97 |
| `Manual.nombreCarta(…)` | 107 |
| `Manual.bloquear(…)` | 121 |
| `Manual.estaBloqueada(…)` | 136 |
| `Manual.liberar(…)` | 141 |
| `Manual.negarAcciones(…)` | 156 |
| `Manual.anularAtaque(…)` | 164 |
| `Manual.retirarDePosicion(…)` | 178 |
| `Manual.forzarPosicion(…)` | 187 |

### `src/js/core/lupa.js`  ·  81 líneas

Expone: `Game.Lupa`

| Función | Línea |
|---|---|
| `Lupa.conectar(…)` | 18 |
| `Lupa.mostrar(…)` | 45 |
| `Lupa.ampliar(…)` | 53 |
| `Lupa.cerrar()` | 76 |

### `src/js/core/audio.js`  ·  217 líneas

Expone: `Game.Audio`

| Función | Línea |
|---|---|
| `Audio.precargar()` | 74 |
| `Audio.cargarNiveles()` | 90 |
| `Audio.nivel(…)` | 100 |
| `Audio.ponerNivel(…)` | 110 |
| `Audio.aplicarNiveles()` | 122 |
| `Audio.volumenDe(…)` | 129 |
| `Audio.reproducir(…)` | 138 |
| `Audio.ponerMusica(…)` | 157 |
| `Audio._arrancar(…)` | 177 |
| `Audio.quitarMusica(…)` | 197 |

### `src/js/core/cinematica.js`  ·  313 líneas

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

### `src/js/core/tutorial.js`  ·  485 líneas

Expone: `Game.Tutorial`

| Función | Línea |
|---|---|
| `Tutorial.esMiTurno(…)` | 324 |
| `Tutorial.vistos()` | 328 |
| `Tutorial.procede(…)` | 335 |
| `Tutorial.toca(…)` | 346 |
| `Tutorial.progresoTour()` | 357 |
| `Tutorial.revisar(…)` | 369 |
| `Tutorial.mostrar(…)` | 393 |
| `Tutorial.colocar(…)` | 452 |
| `Tutorial.limpiar()` | 470 |
| `Tutorial.reiniciar()` | 478 |

### `src/js/core/recordatorios.js`  ·  262 líneas

Expone: `Game.Recordatorios`

| Función | Línea |
|---|---|
| `Recordatorios.reiniciar()` | 113 |
| `Recordatorios.humano(…)` | 121 |
| `Recordatorios.observar(…)` | 131 |
| `Recordatorios.olvidar(…)` | 164 |
| `Recordatorios.pendientes(…)` | 176 |
| `Recordatorios.descartar(…)` | 244 |
| `Recordatorios.marcarVisto(…)` | 249 |
| `Recordatorios.yaVisto(…)` | 253 |
| `Recordatorios.uidsConPendientes(…)` | 258 |

### `src/js/core/combat.js`  ·  198 líneas

Expone: `Game.Combat`

| Función | Línea |
|---|---|
| `Combat.ataqueEfectivo(…)` | 37 |
| `Combat.defensaEfectiva(…)` | 46 |
| `Combat.postura(…)` | 55 |
| `Combat.puedeAtacar(…)` | 61 |
| `Combat.resolver(…)` | 69 |
| `Combat.resolverValor(…)` | 83 |

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

### `src/js/core/accionesIA.js`  ·  312 líneas

Expone: `Game.AccionesIA`

| Función | Línea |
|---|---|
| `AccionesIA.sabeUsar(…)` | 176 |
| `AccionesIA.aplicar(…)` | 188 |
| `AccionesIA.momentoDe(…)` | 241 |
| `AccionesIA.alEquipar(…)` | 248 |
| `AccionesIA.alAtacar(…)` | 256 |
| `AccionesIA.alSerAtacada(…)` | 265 |
| `AccionesIA.cobrarAutodestrucciones(…)` | 273 |
| `AccionesIA._temporal(…)` | 292 |

### `src/js/core/turnEngine.js`  ·  795 líneas

Expone: `Game.SANGRE_TOTAL`, `Game.FASES`, `Game.ETIQUETA_FASE`, `Game.INICIAL_FASE`, `Game.NOMBRE_FASE`, `Game.crearJugador`, `Game.TurnEngine`

| Función | Línea |
|---|---|
| `crearJugador()` | 47 |
| `TurnEngine.constructor(…)` | 89 |
| `TurnEngine.jugadorActivo()` | 117 |
| `TurnEngine.jugadorInactivo()` | 121 |
| `TurnEngine.vidaDe(…)` | 125 |
| `TurnEngine.energiaDe(…)` | 129 |
| `TurnEngine.activoDe(…)` | 134 |
| `TurnEngine.instancia(…)` | 138 |
| `TurnEngine.log(…)` | 148 |
| `TurnEngine.notificar()` | 152 |
| `TurnEngine.iniciar()` | 156 |
| `TurnEngine.estaAturdido(…)` | 164 |
| `TurnEngine.eternalProtegido(…)` | 184 |
| `TurnEngine.esbirrosVivos(…)` | 192 |
| `TurnEngine.defensorEfectivo(…)` | 207 |
| `TurnEngine.interponerEsbirro(…)` | 220 |
| `TurnEngine.derramar(…)` | 252 |
| `TurnEngine.pagar(…)` | 266 |
| `TurnEngine.recuperar(…)` | 279 |
| `TurnEngine.revelar(…)` | 294 |
| `TurnEngine.enviarAlHades(…)` | 298 |
| `TurnEngine.recuperarDelHades(…)` | 329 |
| `TurnEngine.enviarAlVacio(…)` | 361 |
| `TurnEngine.recuperarDelVacio(…)` | 376 |
| `TurnEngine.puedeDesplegar(…)` | 392 |
| `TurnEngine.retirar(…)` | 399 |
| `TurnEngine.desplegar(…)` | 417 |
| `TurnEngine.accionesDisponibles(…)` | 446 |
| `TurnEngine.equipar(…)` | 456 |
| `TurnEngine.atacantesDisponibles(…)` | 488 |
| `TurnEngine.puedeAtacar()` | 496 |
| `TurnEngine.declararAtaque(…)` | 512 |
| `TurnEngine.implicadosAtaque()` | 566 |
| `TurnEngine.previsionAtaque()` | 581 |
| `TurnEngine.cancelarAtaque()` | 587 |
| `TurnEngine.resolverAtaque()` | 596 |
| `TurnEngine.atacar(…)` | 683 |
| `TurnEngine.siguienteFase()` | 690 |
| `TurnEngine.finalizarTurno()` | 704 |
| `TurnEngine.sinPersonajes(…)` | 761 |
| `TurnEngine.comprobarFin()` | 769 |

### `src/js/core/ai.js`  ·  398 líneas

Expone: `Game.AI`

| Función | Línea |
|---|---|
| `AI.jugarTurno(…)` | 80 |
| `AI.jugarFase(…)` | 99 |
| `AI.valor(…)` | 183 |
| `AI.candidatos(…)` | 195 |
| `AI.relevarSiConviene(…)` | 210 |
| `AI.superaA(…)` | 238 |
| `AI.elegirObjetivo(…)` | 250 |
| `AI.puntuarAccion(…)` | 289 |
| `AI.elegirAccion(…)` | 333 |

## Pantallas

Una por archivo. Reciben `(contenedor, params)` y pintan.

### `src/js/screens/mainMenu.js`  ·  216 líneas

Expone: `Game.Screens`

### `src/js/screens/raceSelect.js`  ·  339 líneas

Expone: `Game.Screens`

### `src/js/screens/storyMode.js`  ·  292 líneas

Expone: `Game.Screens`

### `src/js/screens/soloMode.js`  ·  130 líneas

Expone: `Game.Screens`

### `src/js/screens/teamBuilder.js`  ·  327 líneas

Expone: `Game.Screens`

### `src/js/screens/match.js`  ·  2194 líneas

Expone: `Game.Screens`

## Arranque

### `src/js/ui/ambiente.js`  ·  115 líneas

Expone: `Game.Ambiente`

| Función | Línea |
|---|---|
| `Ambiente.html(…)` | 29 |
| `Ambiente.aplicar(…)` | 56 |
| `Ambiente.asegurar(…)` | 98 |
| `Ambiente.conectar(…)` | 110 |

### `src/js/ui/mezclador.js`  ·  126 líneas

Expone: `Game.Mezclador`

| Función | Línea |
|---|---|
| `Mezclador.abierto()` | 17 |
| `Mezclador.alternar()` | 21 |
| `Mezclador.abrir()` | 26 |
| `Mezclador.refrescar()` | 106 |
| `Mezclador.cerrar()` | 116 |

### `src/js/ui/confirmar.js`  ·  93 líneas

Expone: `Game.Confirmar`

| Función | Línea |
|---|---|
| `Confirmar.preguntar(…)` | 26 |
| `Confirmar.cerrar(…)` | 84 |

### `src/js/app.js`  ·  37 líneas

---

Regenerado: `npm run mapa`

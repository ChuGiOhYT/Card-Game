# AETERNUM — guía de trabajo

Juego de cartas por turnos en Electron. Sin dependencias en tiempo de
ejecución: HTML, CSS y JavaScript plano cargado por `<script>` en orden.

**El índice de dónde vive cada función está en [MAPA.md](MAPA.md)** y se
regenera con `npm run mapa`. Este archivo cubre lo que no se deduce leyendo
el código: convenciones, decisiones y trampas ya pisadas.

## Comandos

```bash
npm start          # lanza la app
npm run dev        # con DevTools
npm run datos      # regenera characters.js y actions.js desde los *-source.json
npm run mapa       # regenera MAPA.md
npm run simular    # banco de duelos: mide la IA y el equilibrio entre razas
npm run simular -- --torneo   # compara variantes de la heurística
npm run dist       # compila los .exe (instalador + portable) en dist/
python tools/fondos2d/bosque.py   # repinta las capas del escenario 2D del Bosque
python tools/fondos2d/oasis.py    # … y las del Oasis
python tools/fondos2d/tapetes.py  # repinta los tapetes de la mesa (uno por estirpe)
```

Para compilar sin acordarse de nada, **doble clic en `construir_todo.bat`**:
cierra los Electron colgados, regenera datos y MAPA, compila y enseña lo que ha
quedado en `dist/`. Con `construir_todo.bat rapido` se salta las regeneraciones
y solo compila. Si un paso falla, se para ahí y dice cuál.

## Arquitectura

```
src/js/data/     Contenido: razas, personajes, acciones, criaturas, calabozos
src/js/core/     Reglas y estado. NO tocan el DOM.
src/js/ui/       Capas sueltas que no son pantallas (mezclador, fondo animado)
src/js/screens/  Una pantalla por archivo. Contrato: render(contenedor, params)
src/js/app.js    Registra pantallas en el Router y arranca
```

`ui/` existe porque el Router **destruye** la pantalla anterior: un panel que se
abre a media partida no puede ser una pantalla, o la abandonaría. Son capas
colgadas de `body` con su propio `abrir()`/`cerrar()`. `core/lupa.js` y
`core/tutorial.js` son de la misma especie y acabaron en `core/` antes de que
existiera esta carpeta; su sitio natural es este, pero mover archivos que ya
funcionan no urge.

Reglas que conviene no romper:

- **`core/` nunca toca el DOM.** Todo lo visual vive en `screens/`. El motor
  avisa de cambios con `alCambiar`, y la pantalla repinta.
- **Las pantallas no se hablan entre sí.** Lo compartido pasa por
  `Game.State` o por los `params` del Router.
- **El Router atrapa fallos de render** (`renderSeguro`) y pinta una salida.
  Sin eso, una pantalla que revienta deja la app en blanco y sin botones,
  porque el contenedor ya se vació. Ya pasó dos veces.
- **`pintar()` se llama en cada cambio de estado.** Todo lo que dependa de
  selección del usuario debe conservarse a mano (ver `pintarHerramientas`).

## Archivos generados — no editar a mano

| Generado | Fuente | Regenerar |
|---|---|---|
| `src/js/data/characters.js` | `characters-source.json` | `npm run datos` |
| `src/js/data/actions.js` | `actions-source.json` | `npm run datos` |
| `MAPA.md` | el propio código | `npm run mapa` |

Los `-source.json` son la transcripción literal de las cartas reales de
`Aeternum TCG/Assets base`. **Son la fuente de verdad**: si un valor está
mal, se corrige ahí y se regenera.

## Reglas del juego que el motor implementa

- **Sangre en tres pilas**, suma siempre 30: `pila` (vida) → `gasto`
  (energía, al derramar) → `fuera` (al pagar, permanente). `recuperar` va de
  gasto a pila. Pierdes cuando `pila` llega a 0.
- **La energía es un umbral, no un gasto**: despliegas si
  `coste <= sangre en gasto`. Solo los efectos que dicen «paga» mueven sangre
  fuera del juego.
- **Las acciones no suman números**, solo activan una estadística: ofensiva
  activa el ataque, defensiva la defensa, neutral ninguna. Todo ajuste
  numérico entra por `inst.modificadores`.
- **Combate en dos pasos**: `declararAtaque()` → el jugador aplica efectos →
  `resolverAtaque()`. No se puede avanzar de fase con un ataque pendiente.
- **Un escudo mayor que el ataque REFLEJA la diferencia al atacante.** Es el
  único daño de todo el combate que sangra en el lado de quien golpea, así que
  `resolverAtaque` coge `jugadorActivo` **antes** de resolver: derramar puede
  terminar la partida y cambiar el turno. Va en `res.danoReflejado`, separado de
  `danoSangre` justamente porque tiene destinatario contrario; confundirlos sería
  cobrar el golpe al bando equivocado.

  Pide defensa **estrictamente** mayor: un empate se queda en `fallido` sin
  reflejo. Y no destruye al atacante — el escudo hiere, no mata. Las tres vías
  que resuelven un golpe lo cobran: el ataque normal, el de la IA (que pasa por
  `resolverAtaque`) y `_golpeAlGrupo` de los jefes, que necesita la instancia del
  jefe para saber a qué bando sangrar.

  Medido en 300 duelos de IA contra IA: salta en el **1% de los ataques** (50 de
  3694), aparece en el 17% de los duelos, mueve 1,74 de sangre de media y 0,29
  por duelo de 30. Ninguno se decidió por ello. Es poco en juego automático
  porque la IA evita atacar a lo que no puede superar; contra un humano importa
  más como disuasión que como daño.
- **Los efectos impresos no se ejecutan solos.** El jugador los aplica desde
  el panel de Herramientas (`core/manual.js`), que expone las primitivas
  genéricas. Fue una decisión deliberada para no programar 33 mecánicas.
- **Pero el juego SÍ avisa de cuándo toca.** `core/recordatorios.js` no
  ejecuta nada: mira el `timing` impreso y saca el texto de la carta en el
  momento en que se aplica. Es la mitad barata del problema — las 45 cartas
  reparten 50 mecánicas distintas (unas 35 aparecen una sola vez), pero solo
  12 `timing`, así que una tabla de 12 entradas cubre el mazo entero. Al
  añadir una carta con un `timing` nuevo hay que añadir su regla, y la prueba
  de que no falta ninguna es comparar `REGLAS` con los `timing` del mazo.
- **Con una excepción: las habilidades de los Eternals.** Al jefe no hay
  quien le aplique sus cartas a mano, así que `core/bossAbilities.js` lanza
  UNA de sus cuatro al azar en cada turno suyo y la ejecuta. Están las 16.
  Lecturas que hubo que fijar porque la carta no las cierra: «una serie» es
  un turno; el golpe «al grupo» se resuelve con `Combat.resolverValor()`, o
  sea que cuenta la postura del defensor y sin nadie en posición va entero a
  la sangre; y los contadores («por cada carta revelada»…) miran los dos
  lados salvo que la carta diga «oponente». Todo queda en el registro.
- **Y otra: las cartas de ACCIÓN de la IA, en `core/accionesIA.js`.** Mismo
  problema que el jefe y misma forma (tabla de id → función): la IA no tiene
  manos para abrir Herramientas, así que antes de esto llamaba a `equipar()` y
  su carta activaba la estadística pero **su texto no ocurría nunca**. Una Finta
  que no tiraba el dado, un Bloquear que no subía la defensa ni reflejaba.

  El **cuándo** lo decide el `timing` impreso, no una lista aparte:
  «Fase de combate» → las ofensivas al declarar su ataque (`alAtacar`), las
  defensivas cuando se lo declaran a ella (`alSerAtacada`); «Acción equipada» →
  al acoplarla (`alEquipar`). Los dos ganchos de combate van **antes** de
  resolver, para que la previsión que ve el jugador ya incluya el efecto.

  El gancho defensivo vive al final de `TurnEngine.declararAtaque()`, no en
  `ai.js`, a propósito: así también salta cuando **el humano** ataca, que es el
  caso que importa. Puede cancelar el ataque, y entonces `ataquePendiente` queda
  a `null`: quien llame tiene que comprobarlo.

  Ocho automatizadas de doce. Las cuatro que faltan están en
  `SIN_AUTOMATIZAR` **con su motivo escrito**, para que se vea que es decisión y
  no olvido: piden elegir un objetivo (`d_escape`, `n_comodin`), sacrificar algo
  propio (`d_biomecanica`, `n_devocion`), y aplicarlas a medias sería peor que
  dejarlas fuera. `o_captura` sí está, y su política es declarar el coste del
  personaje **más débil** de la reserva rival: la carta sirve para sacarle a
  campo lo peor que tenga.

  Un efecto que revienta se anota en el registro y la partida sigue: colgar el
  turno del rival por una carta sería peor que la carta.

  De paso salió otro trozo de **código muerto documentado como si funcionara**,
  hermano del de `eternalProtegido`: `accionesNegadas` se escribía y se pintaba,
  pero **no lo leía nadie**. Rompescudos no hacía nada, tampoco para el humano.
  Ahora lo respetan los dos lados, en `AccionesIA.aplicar()`.
- **La oleada no lleva el mismo mazo en la etapa 1 que en la 6.**
  `accionesDeOleada(nEtapa)` reparte solo `ACCIONES_CALABOZO_BASICAS` —Finta y
  Acrobático— hasta `ETAPAS_CON_ACCIONES_BASICAS` (2), y el mazo entero de la 3
  en adelante. **En los cuatro calabozos**, no solo en el primero: cada uno
  vuelve a arrancar suave.

  Las dos básicas son las de dado —tiras, sumas, pegas—; quedan fuera justo las
  que hay que explicar (Inmolación se suicida, Rompescudos apaga las cartas,
  Escape cambia de personaje, Comodín encadena otra). Y las dos están
  automatizadas en `accionesIA.js`, así que en las etapas 1-2 no hay ninguna
  carta rival inerte. Si se añade una carta a las básicas, comprobar eso.

  **Ojo: acotar el mazo las hizo más simples, NO más fáciles.** Medido en la
  etapa 1, mazo acotado contra mazo entero: los duelos pasan de 5,4 a 9,0
  turnos, pero la oleada gana **28 de 32 en vez de 21 de 32**. La causa es
  Inmolación, que con el mazo entero hacía que la criatura se autodestruyera y
  regalara la partida. Quitarla le quita al jugador esas victorias gratis. Para
  aflojar de verdad una etapa temprana el sitio es `etapa.criaturas`, no esta
  lista.
- **Y el jugador usa ese mismo código: «Aplicar» en el recordatorio.**
  `AccionesIA.aplicarManual()` aplica la carta del jugador con los mismos
  efectos que usa la IA (las de `SIN_AUTOMATIZAR` siguen yendo a mano). El
  registro dice «(lo aplicas tú)» y los efectos firman «(tú)» en vez de «(IA)»
  porque `aplicar()` fija `_quien` y cada efecto firma con `this._q()`. El botón
  solo se ofrece cuando tiene sentido (`instParaAplicar` en `match.js`): una
  defensiva de combate solo si te están atacando a ESA carta, una ofensiva de
  combate solo en tu fase de ataque; fuera de eso, se gastaría sin hacer nada.
  Al aplicarla se descarta el recordatorio, así un doble clic no la aplica dos
  veces. Inmolación del jugador se cobra en `siguienteFase()` al cerrar la fase
  de ataque —antes solo la cobraba la IA en su turno—.
- **El jefe se esconde tras sus esbirros, y el esbirro cuenta esté donde esté.**
  Con cualquier esbirro en pie —en posición **o esperando en la zona de la
  oleada**—, un golpe dirigido al Eternal lo encaja el esbirro: se interpone,
  ocupa el puesto y el jefe se repliega (`interponerEsbirro`). Como solo cabe
  un personaje en posición por bando, esa es la única manera de cumplir «si hay
  un esbirro en campo no puedes atacar al eternal» sin tocar la regla del
  activo único. `Convocar` hace la misma maniobra.

  Ojo con la trampa que tenía esto: `eternalProtegido` mira **los dos sitios**
  a propósito. Cuando solo miraba `activos` la condición era **imposible** —la
  oleada tiene `maxActivos: 1`, así que jefe y esbirro no pueden compartir
  posición— y la regla no llegaba a aplicarse nunca. Estuvo así, en código
  muerto, documentada como si funcionara.

  Y hay un consultor aparte, `defensorEfectivo`, que dice quién encajaría
  **sin mover nada**: lo usan las previsiones. Si una previsión llamara a
  `interponerEsbirro`, reordenaría la oleada solo por pasar el ratón.

- **Un jefe replegado SIGUE lanzando habilidades: es la excepción a que solo
  actúe quien está en posición.** Esconderse no es retirarse. `instanciasJefe()`
  toma los jefes de `activos` **y** los de la reserva, y las habilidades ya
  toleran estar detrás: `_duenoDe` busca en los dos sitios y `_golpeAlGrupo` no
  necesita al jefe en el puesto. `Convocar` lo nota y cambia su texto: replegado
  dice «como refuerzo de la oleada» en vez de «se planta delante».

  La distinción fina está en `salioAlCampo`, una marca que pone `desplegar()`:
  **replegado no es lo mismo que «aún no ha salido»**, y desde el estado son
  indistinguibles —en los dos casos el jefe está en la reserva con alguien
  delante—. Sin esa marca, el jefe de la etapa 6 empezaría a castigar desde el
  turno 1, escondido detrás de sus dos esbirros y sin haber aparecido: no es lo
  que se pidió, y adelanta toda la dificultad de la etapa.

  Consecuencia de equilibrio, sin medir todavía: ahora el jefe se cubre **y**
  sigue pegando, así que la etapa 6 es más dura que antes. El golpe al grupo
  ronda los 10 y sube con las cartas reveladas —13 en una prueba real—.
- **El Hades es zona abierta**: todo lo que entra queda revelado, y lo que
  está dentro no se puede volver a ocultar.
- **El vacío es adyacente al Hades, y solo se comunica con él.** Se entra desde
  el Hades (`enviarAlVacio`) y se sale al Hades (`recuperarDelVacio`), nunca al
  campo: sacar algo de ahí cuesta dos movimientos. No se puede mandar al vacío
  algo que esté en posición o en la reserva —primero al Hades—, y el motor lo
  rechaza en vez de permitirlo por descuido. Lo mueve Errante, y a mano se hace
  desde el bloque «Hades y vacío» de Herramientas.

  Tampoco salva de perder: `sinPersonajes` cuenta solo posición y reserva, así
  que quedarte con todo en el vacío es perder igual que con todo en el Hades. Y
  un esbirro en el vacío no cubre a su Eternal, por lo mismo.
- **Se pierde de dos formas**: sin sangre en la pila, o sin un solo personaje
  en pie. Los del Hades no cuentan mientras nada los devuelva.
- **La llave del resto del juego es la recompensa de la historia oculta.**
  `State.desbloqueado()` ya no cuenta calabozos: pide `recompensaFinalRecibida()`
  —los cuatro cristales **y** haber leído la historia oculta—. Leerla ES
  cobrarla: concede los mercenarios, el modo solo y el constructor, y se anuncia
  con las cuatro cartas en la pantalla de estirpes. Antes bastaba un calabozo, así
  que **los guardados anteriores verán cerrados unos modos que tenían abiertos**;
  es el cambio pedido, no un fallo. El cerrojo sigue en `Router.CERRADAS`, no
  solo en el menú.

- **El modo historia es el tutorial y hace de puerta.** Hasta TERMINAR
  `State.CALABOZOS_PARA_DESBLOQUEAR` calabozos enteros —las 6 etapas, jefe
  incluido—, el modo solo y el constructor están cerrados. Sumar etapas
  sueltas de varias razas no cuenta: hay que rematar uno. El cerrojo está en
  `Router.CERRADAS`, no solo en el menú, para que no se pueda entrar por
  otra vía.
- **Las cinemáticas son datos, no código.** `core/cinematica.js` solo sabe
  fundir a negro y pintar un texto dorado; los textos y sus tiempos viven en
  `data/dungeons.js`, en tres campos opcionales: `cinematica` del calabozo (al
  llegar a su pantalla, una vez por sesión), y `cineEntrada` / `cineVictoria`
  de cada etapa. Añadir narración a un calabozo es rellenar esos campos, no
  tocar pantallas. Ahora mismo solo el Bosque Nocturno los tiene.
- **Cada Eternal derribado deja su gema, y no sirve para nada.** Es constancia,
  no equipo: no se despliega, no se equipa y no toca ninguna regla. Vive en
  `DUNGEONS[raza].gema` y se entrega al ganar la etapa del jefe. Por eso el
  bloque de fin de partida va **aparte** del de recompensas, que sí son cartas
  jugables. Las cuatro juntas abren la historia final
  (`State.historiaFinalDesbloqueada()`), que **todavía no tiene contenido**: se
  anuncia con un texto y a propósito **sin ningún botón**, para no ofrecer un
  camino que no lleva a ninguna parte.

  Dos cosas que conviene no romper. `otorgarGema` devuelve si **era nueva**, y
  de eso depende que el mensaje diga «la conseguiste» o «ya la tienes»: repetir
  la etapa del jefe no vuelve a dar nada. Y `sincronizarGemas()`, que corre en
  cada arranque desde `app.js`, deduce del progreso las gemas de los calabozos
  ya terminados: las gemas llegaron después que la campaña, y sin eso quien ya
  hubiera acabado un calabozo se quedaba sin la suya para siempre. Solo añade,
  nunca quita.

  Los textos de las gemas son **provisionales**, pendientes de la prosa
  definitiva.

  **El aviso de la recompensa es de un solo uso, y la vitrina se encoge después.**
  La pantalla de estirpes no se desplaza (`.pantalla` es `overflow: hidden`) y lo
  único flexible es la ficha de la estirpe, así que todo lo que se quede fijo ahí
  arriba se lo quita a ella. Medido: con el aviso puesto, la ficha tenía 38 px de
  los 310 que necesita —272 escondidos—. Al cerrarlo, la sección de cristales pasa
  a su versión de una línea (343 → 38 px) y la ficha sube a 298. Si añades algo
  permanente a esta pantalla, mide la ficha antes de darlo por bueno.

  **Desde el 19-nov ya no es una casilla: es una VENTANA GRANDE** (Oscar: en
  la casilla no se podían revisar las recompensas). `bloqueRecompensaFinal`
  pinta `#recompensa-final` (`.rf-velo`, fija sobre la pantalla) con los
  cristales, las seis cartas grandes (tocar una la amplía con
  `Lupa.ampliar`) y los dos modos que se abren. Se cierra con «Entendido»,
  Esc (en captura: con una carta ampliada, Esc cierra solo la carta) o
  tocando fuera. Como ya no ocupa la vitrina, ésta pasa a compacta en cuanto
  la historia está leída. Lo de abajo sobre sustituir la sección en caliente
  ya no aplica a este aviso.

  Y ojo con repintar aquí: `render()` relee la estirpe del **perfil**, donde solo
  está la confirmada con «Comenzar historia». Un `render()` a media navegación
  borra la ficha que el jugador estaba mirando; por eso cerrar el aviso sustituye
  solo esa sección en caliente y vuelve a enganchar su botón
  (`conectarHistoriaFinal`).

- **La campaña es lineal.** El orden lo manda `RACE_ORDER`
  (desterrado → lunaria → oxitron → reanimado): cada calabozo se abre al
  terminar el anterior. `RACE_ORDER` no es solo el orden de pintado, así que
  reordenarlo cambia la progresión del juego.
- **El equipo de historia se recalcula, no se guarda.** `equipoDeHistoria()`
  suma `personajesIniciales` más las recompensas de las etapas ya superadas,
  así que tocar esos datos cambia el equipo también en las partidas ya
  guardadas: el progreso solo anota cuántas etapas llevas.
- **Una recompensa puede no traer personaje.** Todos los calabozos dan
  personaje + acción en cada etapa menos la 2 del Oasis, que da solo la
  acción: allí los espíritus acompañantes ya entran con Sadash desde la etapa
  1 —sola no aguanta a los centauros— y no hay un séptimo lunaria que dar. Por
  eso el panel de fin de `match.js` pinta las cartas que existan en vez de dar
  las dos por hechas. Los cuatro calabozos siguen acabando en 6 personajes y
  8 acciones.

## Lecturas de cartas fijadas por Oscar (para automatizarlas todas)

Respuestas suyas a lo que las cartas no cierran. Mandan sobre cualquier
interpretación propia:

- **Sangrado xN = derramar N.** Sadash, al retirarse: el oponente derrama 1 por
  cada lunaria revelado.
- **«Revelados» cuenta TODO lo revelado de los dos bandos, en campo y manos**
  (así un espejo lunaria contra lunaria escala para los dos). Vale para
  Lydia, Auram, Acompañantes, Fälum y compañía.
- **Yrving:** si el rival no tiene ninguna acción del tipo declarado, no aplica.
- **Duraciones en turnos** (Pip, Kaw, Kratox, Diplomático…): cuentan los turnos
  de LOS DOS jugadores. «Este y el siguiente» = el turno del jugador activo y
  el siguiente del rival.
- **Comodín** no puede encadenar otro Comodín.
- **Tilos y Biomecánica:** una u otra, nunca las dos a la vez en el mismo
  personaje.
- **Una carta queda revelada desde que se USA** (sale a posición, se acopla) y
  sigue revelada aunque vuelva a la mano; deja de estarlo SOLO al ir al Hades
  o al destierro (vacío). `desplegar`/`equipar` revelan y `enviarAlHades`
  borra de `revelados`.
- **«Revelado:»** (Lydia, Acompañantes, Seluah, Tilos, Zhin) funciona solo con
  la carta revelada en la mano; no en posición ni en el Hades.
- **Sabotaje** actúa solo acoplada a tu personaje en posición, sobre cualquier
  dado del rival. **Yun** solo toca los dados de cartas de ACCIÓN, y pregunta.
- **Elecciones en el turno del rival** (Zhin, Campo caótico) paran el juego y
  esperan, sin cuenta atrás. Y **la fase de Personaje nunca avanza sola**.
- **Si una carta da opción («o», «puedes»), se PREGUNTA** al jugador; la IA
  elige con su regla. Hoy Annia/Axel/Thiana/Erem toman el aumento sin
  preguntar: es provisional hasta que exista el sistema de elecciones.

## La base para automatizar todas las cartas (tanda 1)

- **Elecciones** (`motor.elegir({ jugador, titulo, opciones, ia, alElegir })`):
  si elige la IA, su regla `ia(opciones)` decide al instante (una regla que
  revienta cae a la primera opción); si elige un humano, queda
  `motor.eleccionPendiente` y el turno ESPERA —`siguienteFase`, `desplegar`,
  `equipar` y `declararAtaque` se niegan, `AI.jugarFase` se para, y la mesa
  no corre ninguna cuenta atrás— hasta `resolverEleccion(id)`. Con una sola
  opción no se pregunta. La pantalla la enseña como una placa sobre la mesa
  (`pintarEleccion`, `#eleccion`), sin cuenta atrás (Oscar). El simulador y
  el banco no la ven nunca: allí juegan dos IA.
- **Estados con duración** (`ponerEstado`, `tieneEstado`, `estadosDe`):
  `inmune` (no se le puede atacar; con todos los de enfrente intocables no
  hay ataque, ni a la sangre), `sinAtaques` (nadie declara) y
  `personajeBloqueado` (no se despliega y sus efectos se niegan, `negado()`).
  Cuentan los turnos de LOS DOS, incluido el turno en que se ponen, y caducan
  en `finalizarTurno`. En la carta, pastillas «⛨ 2» / «⛓ 3»
  (`chipsEstado`); «nadie puede atacar» va en la banda.
- **Código muerto destapado:** los bloqueos de acciones (`motor.bloqueos`, de
  Herramientas) se guardaban y se pintaban pero `accionesDisponibles` no los
  leía: una acción bloqueada se acoplaba igual. Ahora no.
- **Ganchos nuevos** en `EfectosPersonaje`, vacíos hasta que llegue su carta:
  `alRetirarse` (desde `retirar`), `antesDeDestruir` (desde `motor.destruir`,
  que usa el combate; devolver true lo evita) y `alFinDeTurno`.
- **Annia, Axel, Thiana y Erem PREGUNTAN** «aumento o revelar». Revelar
  pregunta CUÁL, una a una (Oscar: el jefe del Bosque escala con lo revelado,
  así que el jugador tiene que poder elegir): opciones por posición («Acción
  oculta 2», boca abajo no se sabe cuál es cuál, marcadas `revelar: true`) y,
  tras la primera, «Terminar» («hasta N»). En pantalla los reversos elegibles
  de la mano rival laten y se pinchan (`[data-revelar]`), y lo revelado se pinta
  BOCA ARRIBA en esa mano (`pintarManoRival`; antes seguía todo de reverso y
  no se veía qué se había revelado). La IA elige al azar. Sin nada oculto, no hay pregunta: aumento. La IA revela si
  lleva Lydia o Auram; si no, el aumento.

Probado: `probar-base.js` (18 casos) y `probar-pasivos.js` (13) en el
scratchpad, 4.800 duelos IA contra IA sin cuelgues ni tablas, y en pantalla.

## Tanda 3: dado y estados

- **`Manual.tirar(motor, { jugador, motivo, deAccion, valor }, alTener)`** es la
  tirada de los EFECTOS (el botón del dado de la mesa sigue con `dado()`: es
  herramienta, no carta). Aplica Sabotaje (−2 si el RIVAL lo tiene acoplado a
  su personaje en posición) y Yun (±1 solo en dados de ACCIÓN de su dueño, si
  está en posición o revelado en la mano). Yun PREGUNTA al humano, así que el
  resultado llega en `alTener` y no de vuelta: Finta, Bloquear y Acrobático
  pasaron a continuación (`_bloquear`, `_acrobatico` en `EFECTOS`, llamados con
  `.call(this, …)` porque `this` es `AccionesIA`, no `EFECTOS`). La IA elige el
  ±1 con `valor(n)` de cada carta (Bloquear prefiere 1 y 6).
- **Pip** (1-3: intocable tantos turnos), **Brawl** (≥3: devuelve la acción
  acoplada del rival a su zona), **Kaw** (eliges acción del rival, bloqueada
  N turnos) y **Kratox** (eliges personaje de su reserva, bloqueado y negado N
  turnos) van en `EfectosPersonaje.CON_DADO`. Al elegir cartas del rival, las
  ocultas salen como «Acción oculta N»: no se sabe cuál es cuál. La IA bloquea
  la ofensiva revelada, o una al azar; Kratox, el revelado más caro.
- **Diplomático** paga 2 y pone «sin ataques» 2 turnos (este y el siguiente);
  sin 2 de energía no hace nada. **Sabotaje** no hace nada al acoplarse: es
  pasiva y la lee `tirar`.
- Kratox niega también los PASIVOS del bloqueado (Lydia en la mano, etc.).

Probado: `probar-tanda3.js` (19 casos, con el dado fijado), más las baterías
anteriores; 4.800 duelos sin cuelgues; pastillas y aviso en pantalla.

## Tanda 4: objetivos y cartas entre zonas

- **Lirhym**: eliges una acción del rival y queda bloqueada MIENTRAS Lirhym
  siga en posición (`Manual.bloquearMientras`: bloqueo con `mientras: uid`;
  `estaBloqueada` lo ignora si esa instancia ya no está en posición y
  `finalizarTurno` lo limpia).
- **Vyla**: manda un Reanimado de tu zona de equipo al Hades (obligatorio si
  hay). La IA prefiere Ejército, luego Gurh, luego el más barato.
- **Luh**: opcional; Luh va al Hades y un Reanimado REVELADO de tu reserva
  entra en posición sin pagar (y dispara su propio «En posición»).
- **Lyla**: opcional; recupera del Hades un personaje de coste ≤5 pagando su
  coste (solo se ofrecen los que puedes pagar).
- **Yrving**: declaras un tipo entre los que el rival TIENE disponibles (si no
  tiene de ese tipo, no aplica). Estado `tipoForzado` con `valor` (nuevo campo
  de `ponerEstado`) 2 turnos: `accionesDisponibles` le deja solo ese tipo, y
  el estado se cumple y se va al acoplar una de ese tipo.
- **Errante** («Acción equipada», va en `alEquipar`): ofensiva → un personaje
  del Hades (de cualquier bando) al vacío; defensiva → uno del vacío al Hades;
  neutra → recupera 1 sangre.
- **Sadash** (`alRetirarse`, solo al volver a la reserva, no al morir): el
  rival derrama 1 por cada lunaria revelado en los DOS bandos.
- **Seluah** revelada en la mano: al declararse un ataque donde tu activo es
  lunaria, ofrece mantener o cambiar su acción por otra disponible. La IA
  prueba cada opción con `Combat.resolver`.
- **Zhin** revelado en la mano: en el golpe normal, `resolverAtaque` PREGUNTA
  («Sacrificar a Zhin» / «Dejar caer») y la segunda mitad del golpe vive en
  `_cobrarGolpe`, que espera la respuesta. Si dices que no, `destruir(…,
  { yaDecidido: true })` para que `antesDeDestruir` no lo vuelva a ofrecer.
  Otras destrucciones (jefe, Inmolación) no pueden esperar: Zhin se sacrifica
  solo. La IA siempre sacrifica.
- **Candados**: `resolverAtaque` devuelve null con una elección pendiente (el
  golpe espera a Seluah), y el auto-resolver de la mesa y `autoAplicar` no
  arrancan mientras haya una.

Probado: `probar-tanda4.js` (21 casos), más las baterías anteriores; 4.800
duelos sin cuelgues ni tablas (los reanimados siguen en 15–30 % frente al
resto, igual que antes de la tanda).

## Tanda 5: las acciones que faltaban y Tilos

Con esto TODAS las cartas tienen efecto automático (`SIN_AUTOMATIZAR` vacío).

- **Defensivas de combate (Escape, Campo caótico, Biomecánica)** solo actúan
  cuando te han declarado el ataque a ti (`_meAtacan`); fuera de eso no hacen
  nada. Por eso `autoAplicar` ya no aplica tus defensivas hasta que el rival
  declara (antes Bloquear se tiraba en cuanto empezaba su fase de ataque).
  - **Escape** (opcional): entra uno de coste ≤ y el golpe pasa a apuntarle;
    Escape vuelve a la zona, así que el que entra llega sin acción (neutral:
    el golpe le atraviesa a la sangre). La IA escapa si la iban a tumbar y la
    sangre aguanta.
  - **Campo caótico**: «Con la defensa» o «Ataque directo a la sangre»
    (`defensorUid = null`).
  - **Biomecánica** (opcional): el elegido de tu reserva suma ataque y
    defensa (temporal); al final del turno va al Hades y la carta vuelve a la
    zona. LECTURA MÍA: la carta sigue acoplada hasta el final del turno, porque
    si volviera a la zona en el acto el defensor quedaría neutral y el golpe le
    atravesaría. Tilos no puede ser el elegido (una u otra).
    Los pendientes de fin de turno van en `motor.pendientesFinTurno`.
- **Encadenar** (con un Oxitrón en posición): pagas 1 y el RIVAL elige quién
  de sus revelados entra; el que sale queda bloqueado 2 turnos (LECTURA MÍA de
  «un turno»: el del rival, contando los dos como manda Oscar).
- **Devoción**: tu activo al Hades, recuperas su coste (lo que haya en gasto).
  La IA solo la acopla con 4 o menos de vida, gasto suficiente y reserva.
- **Llamada**: un Reanimado de tu Hades vuelve pagando su coste.
- **Investigar**: revela a ciegas una acción o personaje oculto del rival.
- **Ocultamiento** (con un Desterrado en posición): hasta dos acciones
  reveladas de las ZONAS de acciones (de los dos, no las acopladas) vuelven a
  ocultas. Pregunta dos veces; `elegir` lleva ahora un contador propio
  (`_nEleccion`) para que la segunda placa se repinte.
- **Comodín** («Cualquier fase», se dispara al acoplar): opcional; vuelve a la
  zona y acopla otra acción tuya REVELADA, que se activa si es de «Acción
  equipada» o «Cualquier fase». Nunca otro Comodín.
- **Tilos** (revelado en la mano): al entrar en tu fase de acción pregunta
  «No / Ofensiva +4 / Defensiva +4». Va en `inst.tilos = { tipo, carta }`,
  ocupa el puesto de la acción (`Combat._accion`) y sale de la reserva; si
  luego acoplas una acción, Tilos vuelve a la mano. Se destruye al final del
  turno del OPONENTE, o en cuanto su anfitrión deja la posición. La IA solo lo
  usa si no le queda ofensiva.

Probado: `probar-tanda5.js` (26 casos), más las cuatro baterías anteriores;
4.800 duelos sin cuelgues ni tablas.

## Tanda 6: la IA valora en contexto, pruebas en el repo y equilibrio

- **`AI.valorEnCampo(motor, yo, inst)`**: lo impreso + los pasivos que le
  tocarían EN POSICIÓN (los suyos y los de sus aliados desde mano o Hades) −
  lo que le quita al rival (Thila), y +3 a Vyla si tiene otro Reanimado que
  mandar al Hades. Se calcula poniéndolo un instante en `activos` y llamando a
  `PASIVOS` (que solo leen). Lo usan `candidatos` (orden de despliegue) y
  `relevarSiConviene`; `superaA` mira `ataqueEnCampo`. `puntuarAccion` estima
  la respuesta del rival con su pasivo y modificadores, no con lo impreso.
- **Pruebas en el repo**: `node tools/probar-efectos.js` corre las cinco
  baterías de `tools/pruebas/` (97 casos: base, pasivos, dados y estados,
  objetivos y zonas, acciones y Tilos). `--todo` enseña cada caso. Al tocar
  un efecto, añadir su caso a la batería que toque.
- **`npm run simular -- --sin-mercenarios`**: equipos de una sola raza, como
  los de la IA del juego.

Equilibrio medido (300 duelos por cruce, % que gana la fila):

| | con mercenarios | sin mercenarios |
|---|---|---|
| Reanimados contra el resto | 13-31 % | 17-31 % |
| espejo Reanimado | ~59 % / 41 % | ~50 % |

La IA nueva sube a los Reanimados unos 4-5 puntos, pero el hueco es de
cartas: media impresa 2,3/4,5 frente a 4-5,7 de ataque del resto, y su motor
(llenar el Hades) llega tarde. No se ha tocado ninguna carta: es decisión de
Oscar (ya descartó tocar números impresos de las criaturas).

## Narración y bocadillos

- **`docs/BIBLIA.md` es la referencia del mundo**: cosmología, estirpes,
  Eternales, personajes, tono. La campaña es la PRECUELA del libro de Oscar
  (`Aeternum - Historia - 08-07-26.docx`); nada de la campaña puede impedir
  el libro. Un Eternal por Eterno: Iskar (Orden, Bosque), Brahma (Muerte,
  Oasis), A’tar (Caos, Forjas), Tarh Akh (Vida, Catacumbas). **Iskar se
  llamaba Üldar**; el id sigue siendo `cri_uldar` (no lo cambies: lo usan
  arte, habilidades y guardados). Zhin está detrás de las ratas del Bosque y
  es SECRETO: nunca nombrarlo en el calabozo.
- **Los textos de los cuatro calabozos se reescribieron** desde la biblia
  (las cinemáticas de Oscar conservan sus hechos: Aj’Khul, la voz nueva que
  ordena a los Persecutores…). Todas las etapas tienen ahora `dialogo`,
  `cineEntrada` y `cineVictoria`.
- **Bocadillos** (`ui/bocadillos.js` + `data/frases.js`): en los duelos de
  CAMPAÑA los personajes hablan al entrar en posición, al tumbar a alguien,
  al caer y con poca sangre; los jefes al aparecer, al empezar alguno de sus
  turnos, al bajar de la mitad y al caer. Una frase a la vez, en cola; lo que
  espera más de 3,5 s se tira. Con tutorial, nadie habla. En Catacumbas y
  Forjas (sin escenario 2D) el `dialogo` de la etapa se dice en bocadillos al
  empezar el duelo. Ganchos: `iniciar` en `render`, `revisar` en
  `reaccionarASucesos`, `parar` en `destruir`. Trampa ya pisada: no limpies
  `temporizador` para arrancar la cola, que es también el que retira el
  bocadillo visible (se quedaba colgado para siempre).

## Primer turno sin ataque y mazos por estirpe

- **Quien abre no ataca en su primer turno** (Oscar): `numeroTurno === 1`
  vacía `atacantesDisponibles` y hace fallar `declararAtaque` (también una
  intención remota). La mesa lo avisa («Primer turno: todavía no se puede
  atacar»). Vale en todos los modos, calabozo incluido (sin medir su efecto en
  las etapas). Las baterías de pruebas arrancan sus mesas en el turno 2.
- **`Team.MAZOS_BASE`**: el mazo por defecto de cada estirpe, con identidad
  (IA del modo solo, «Autocompletar», duelo remoto sin equipo elegido; la
  campaña no). Medido IA contra IA (1800 duelos, `mazos.js` en el
  scratchpad): desterrado 80 %, lunaria 45 %, oxitrón 45 %, reanimado 30 %.
  Lo que decide los cruces son las cartas de coste 10: Kratox solo cambia a
  los Oxitrones de 100 % a 0 %, y Auram a los Desterrados de ~85 % a ~24 %.
  Antes (los 5 más baratos + acciones genéricas): lunaria 98 %, reanimado 5 %.

## La marca registrada (INAPI)

Oscar registró la marca AETERNUM: **las letras van siempre como en su logo**
(serifa romana, la A y la M altas, el resto en versalitas, en oro). Es
**Cinzel**, incluida en `src/assets/fuentes/` (woff2 400/600/700/900, licencia
OFL al lado) y cargada con `@font-face` al principio de styles.css: ya no
depende de internet ni de las fuentes del sistema. Como las minúsculas de
Cinzel son versalitas, el título se escribe «AeternuM» (con `aria-label`
«AETERNUM»). `--fuente-titulo` la usa en todos los títulos.

Estética sutil del logo: tokens `--marca-noche/-violeta/-magenta/-cian`, una
nebulosa violeta y cian en el fondo del `body`, el emblema hexagonal en SVG
tras el título del menú (`EMBLEMA` en mainMenu.js: filetes de oro, nodos en
los vértices, orbes violeta y cian) y el filete con rombo y nodos. Logo en
`assets/marca/` (también de favicon). Cinzel es más ancha que Palatino: los
títulos ocupan más; medir si algo se parte.

**Volver** (todas las pantallas con `.btn-volver`): círculo dorado con una
flecha curva hacia atrás y el nombre al lado (Oscar: «más visible»). La flecha
es un SVG EN EL HTML (`.volver-ico`): como máscara `data:` en el CSS no se
pinta, porque la CSP (`default-src 'self'`) bloquea las imágenes `data:`.

**Estirpes: el líder SALE de la carta** por arriba (`.raza-tarjeta` con
`overflow: visible`, el tapete recortado con su propio radio, `.rt-lider` al
92 %, y la rejilla baja un poco para dejarle sitio). Medido en 1024×700 y
1194×728: la ficha sigue sin desbordar (a 6vh de margen se pasaba 7 px). En el
teléfono asoma menos (84 %) y el botón es más chico, para no pisar el texto.

## Aviso de la condición de victoria

Oscar: «muchas victorias se sienten raras, no sé por qué gané». Al empezar el
duelo sale una vez «Gana quien deje al rival sin sangre o sin personajes en
pie» (`condicionAvisada`; el aviso de fase espera a que se vaya). Y el cartel
de fin (`textoMotivo`) dice la regla, cómo se cumplió y **la última gota**:
el motor guarda en `ultimaCausa` lo último que derramó sangre o mandó al Hades
a cada jugador, y `comprobarFin` lo copia a `causaFin` si fue al perdedor. Lo
que más sorprendía es el derrame de 1 al cerrar el turno, que se nombra así.
**Ojo: hasta aquí el fin de turno derramaba 1 de LOS DOS jugadores**; ahora
solo de quien cierra (Oscar). Las mediciones anteriores (mazos, sangre de las
etapas del calabozo) son con la regla vieja. Con la nueva, mazos por estirpe:
desterrado 87 %, lunaria 32 %, oxitrón 42 %, reanimado 39 % (16 turnos de
media).

**En el calabozo abre la OLEADA** (Oscar), en `render` de match.js
(`turnoDe = 1` si hay `etapa`): abriendo tú, la regla del primer turno rompía
la etapa 1 del Bosque y de las Forjas (34 % y 33 %: con un solo personaje no
pegabas y la rata te lo mataba), y la sangre no lo arreglaba. El recorrido del
tutorial espera a TU primer turno (`toca`, turno ≤ 2). Sangre reajustada con
`afinar-sangre.js` del scratchpad (200 duelos por etapa, sangre → % ganado):

| Calabozo | 1 | 2 | 3 | 4 | 5 | jefe |
|---|---|---|---|---|---|---|
| Bosque | 5→100 | 8→95 | 18→86 | 13→100 | 20→100 | 35→62 |
| Oasis | 6→91 | 10→100 | 5→100 | 5→100 | 12→100 | 8→66 |
| Forjas | 3→100 | 5→100 | 8→81 | 6→82 | 15→81 | 8→63 |
| Catacumbas | 6→100 | 15→96 | 8→73 | 4→100 | 10→100 | 12→64 |

**Jefes endurecidos: el Eternal sale PRIMERO** (`criaturas: [jefe, esbirro,
esbirro]`). Saliendo el último no se asomaba casi nunca (1 de cada 60 duelos):
la oleada rotaba a los esbirros, el jefe no lanzaba nada (exige `salioAlCampo`)
y se ganaba desangrando a dos 4/4. Ahora se presenta, lanza desde su primer
turno y los esbirros le cubren (`interponerEsbirro`). Ojo: `afinar-sangre.js`
no lanzaba las habilidades (las lanza la PANTALLA, `lanzarHabilidadesJefe`, no
`AI.jugarTurno`); ya las lanza igual que la mesa. Sangre y % ganado: Bosque
35 → 62, Oasis 8 → 66, Forjas 8 → 63, Catacumbas 12 → 64. Las etapas 4-5 que
salen al 100 % no dependen de la sangre (ni con 40 bajan). Las tablas de sangre más
abajo en este archivo son de antes de estos cambios. Los motivos de `derramar` se traducen en `QUE_DERRAMA`; uno nuevo sin entrada
sale como «el efecto «motivo»».

## Hades y destierro en la mesa (`zonaFuera` en match.js)

Dos zonas de verdad junto al personaje en posición, en los dos lados y
siempre a la vista (antes: una pastilla con miniaturas de ~25 px y el vacío
solo cuando tenía algo, debajo de todo). Un hueco del tamaño de una carta con
las últimas 5 en abanico (`CARTAS_EN_ZONA`; la de arriba, la más reciente), el
total en una pastilla y un ícono cuando está vacío. Hades: brasa morada y
roja, ☠. Destierro (= el vacío): frío, punteado, cartas apagadas en azul, ✧.
Tocar una carta la lleva a la lupa. Conservan las clases viejas (`hades`,
`casilla-hades`) porque se anclan ahí el tutorial y los recordatorios.

**Van a la IZQUIERDA de la carta y fuera del reparto de la fila**
(`.zonas-fuera` absoluta dentro de `.lado-campo`): el retrato flotante está
corrido a la derecha de la carta (`.flotantes-lado`), y a la derecha las
tapaba (Oscar); metidas en la fila, recentraban el conjunto y dejaban la CARTA
bajo el retrato. Así la carta queda donde siempre. Orden: Hades pegado a la
carta, destierro más afuera. En tu lado suben un poco (`translateY(-40%)`)
para no rozar la caja de tu mano. Medido en 1194×728 y 915×412: 0 de cruce
con el retrato y con la mano.

## Voces «pipipi» (`ui/voces.js`)

Al hablar, cada letra suena con un pitido cuadrado corto generado con WebAudio
(sin archivos), una letra de cada dos, nunca en espacios ni signos, con 55 ms
mínimos entre pitidos. Tono por personaje (hash del id; `cri_…`/Eternals más
graves). Mando: «Efectos de batalla». Lo usan el diálogo del escenario 2D
(ya se escribía letra a letra; un clic que salta no suelta ráfaga) y los
bocadillos del duelo, que ahora se ESCRIBEN letra a letra (38/s) con el tamaño
fijado al del texto entero para que no crezcan; las acotaciones «(…)» salen
enteras y mudas.

## Narrador (voz «mayor»)

- **Las cinemáticas de la campaña pueden leerse en voz alta** con la voz
  «mayor» de Oscar (Chatterbox local en `Documents\combo-shorts`, la misma
  de los shorts). Sonido → «Voz del narrador»: Apagado (por defecto) /
  Normal / Suave (= emoción «calma»), con su propio mando de volumen
  (`Audio.GRUPOS.narrador`). Preferencia en `perfil.narrador`.
- **Se generan aparte, no en el juego**: `GENERAR_NARRACION.bat` (o
  `node tools/narrador/generar-narracion.mjs`, con `--listar`, `--solo
  <raza>` y `--limite N`). Narra la cinemática de cada calabozo y la entrada
  y la victoria de cada etapa (52 textos × 2 tonos). Deja Opus mono en
  `src/assets/narracion/<tono>/` (~70 KB cada uno) y el índice
  `assets/narracion/narracion.js` (generado, no editar). Solo rehace lo que
  cambió y borra los audios huérfanos.
- **Se busca por el hash del TEXTO** (FNV-1a, el mismo en la herramienta y
  en `ui/narrador.js`): `Cinematica.mostrar(texto)` pregunta si hay voz para
  ese texto exacto. Si editas un texto y no regeneras, no suena (nunca una
  voz equivocada). La escena dura lo que la voz si es más larga que la
  lectura, y saltarla calla la voz.
- **Pronunciación**: `tools/narrador/pronunciacion.txt` («escrito = dicho»),
  solo para la voz. Cambiarla rehace los textos afectados.
- Usa la tarjeta gráfica: 104 audios tardan del orden de 15-20 minutos.
- **Tono «anciano»: Gemini TTS en línea** (`gemini-3.8-flash-tts`, voz
  Algenib, elegida por Oscar entre 8 muestras de `tools/narrador/muestras`).
  Clave: `clave_gemini.txt` de edu_gear (`gemini-tts.mjs` la lee; nunca se
  escribe en nada generado). **El plan gratuito da 10 peticiones al día por
  modelo** (cuota `GenerateRequestsPerDayPerProjectPerModel-FreeTier`; solo
  se distingue en `error.details`, no en el mensaje). Por eso se piden hasta
  6 escenas por petición y `alinear.py` (Whisper de combo-shorts) las corta y
  valida: descarta las que se oyen a medias, las demasiado largas y las
  REPETIDAS. Trampa: con `word_timestamps` Whisper se salta a veces un tramo
  entero (justo la repetición), así que las repeticiones se cuentan con una
  segunda escucha sin tiempos por palabra. Lo malo o lo que no cabe en el
  cupo queda para el día siguiente: el índice se guarda tras cada petición.
- Trampa de Gemini TTS: una instrucción de estilo EN ESPAÑOL delante del
  texto se lee en voz alta. La forma que no la lee es inglés con «Say in the
  voice of …: <texto>».

## Duelo remoto 1 contra 1 (en tandas)

Plan: 1) conexión ✔ · 2) motor en red ✔ · 3) mesa ✔ · 4) cierre ✔ (el anfitrión manda: corre el motor,
el invitado solo envía intenciones y recibe la mesa; el azar sale solo del
anfitrión) · 3) mesa para dos humanos (`match.js` hoy asume jugador 0 humano
y 1 IA; reverso oficial `reverso.webp` en la mano rival) · 4) equipos del
constructor, desconexión, abandono, reconectar.

**Tanda 1 — `core/red.js` + `screens/remoto.js`** (carta «Duelo remoto» del
menú, abierta siempre; «Juega online» sigue llevando a TCG Arena):

- WebRTC de PC a PC (canal de datos `aeternum`, JSON). Para presentarse se usa
  el servidor público gratuito de PeerJS (`wss://0.peerjs.com`), hablándole
  **a mano**, sin la librería (OPEN / OFFER / ANSWER / CANDIDATE / EXPIRE /
  HEARTBEAT cada 5 s). En cuanto abre el canal se cierra el servidor: la
  partida no pasa por él. STUN de Google; **sin TURN** todavía (las redes que
  no permiten conexión directa fallan con un aviso claro).
- Sala = id `aeternum-duelo-<CÓDIGO>` del anfitrión; código de 6 sin letras
  confundibles, enseñado `K7Q-2MX`. Invitado: id aleatorio. Una sala es para
  dos: al tercero se le contesta «ocupada» (por CANDIDATE, ver trampa).
- **Trampa: el servidor de PeerJS CIERRA el WebSocket de quien manda un
  OFFER o ANSWER sin la forma de su librería** (`connectionId`, `label`,
  `reliable`, `serialization`, `browser`). Sin eso la oferta no llegaba nunca
  y el invitado se quedaba 25 s esperando. `_carga()` la pone siempre.
- La CSP de `index.html` lleva `connect-src` con `wss://0.peerjs.com` (sin
  eso el WebSocket se bloquea en silencio).
- Mensajes internos: `hola` (nombre, `PROTOCOLO`), `ping`/`pong` cada 2 s,
  `adios`; los de la partida van como `{ t: 'app', d }` → evento `mensaje`.
  `Red.enviar(datos)`. La pantalla tiene un chat de prueba.
- `screens/remoto.js` cierra la conexión en `destruir()` salvo `mantener`
  (para cuando navegue a la partida en la tanda 3). Nombre en
  `perfil.nombreRemoto`.
- Prueba: `medir-remoto.js` en el scratchpad (dos ventanas en el mismo PC:
  conectan en ~1,3 s, chat, sala ocupada, código inexistente, rival que sale).

**Tanda 2 — el motor en red (`core/sincro.js` + `core/dueloRed.js`)**, sin
pantalla todavía:

- **El anfitrión manda.** Corre el TurnEngine real con dos humanos
  (`jugadores[0]` anfitrión, `[1]` invitado). `DueloRed.anfitrion({ motor,
  red })` envuelve `alCambiar` y manda una FOTO tras cada cambio (varias
  notificaciones seguidas salen en una, por microtarea). El azar sale solo de
  ahí, así que no hay semillas que sincronizar.
- **El invitado juega con un MOTOR ESPEJO** (`DueloRed.invitado({ red,
  alCambiar })`): prototipo del TurnEngine, así que las consultas
  (`LECTURA`: accionesDisponibles, energiaDe, atacantesDisponibles…) van
  igual; todo lo demás (desplegar, equipar, siguienteFase, resolverEleccion,
  derramar…) se convierte en INTENCIÓN y devuelve una PROMESA `{ ok, motivo }`
  (no el booleano de siempre: ojo en la tanda 3). `previsionAtaque` no
  recalcula pasivos (vienen en la foto). `espejo.intento(op, …)` para lo que
  no es un método del motor: `modificar`, `limpiarModificadores`, `dado`,
  `aplicar` (tus acciones automatizadas: lo que `autoAplicar` hace en tu PC lo
  aplica el anfitrión, una vez por carta y momento). El espejo es SIEMPRE el
  mismo objeto (la pantalla compara `this.motor === m`), y los campos que no
  cambian conservan su objeto (un ataque pendiente no parece nuevo en cada
  foto).
- **Validación** (`INTENCIONES`): solo en su turno, o en SU pregunta; solo
  sus cartas y su sangre; nada que empiece por `_`; terminado, nada. Lo que
  no está en la tabla (Hades/vacío de Herramientas, por ahora) se rechaza con
  motivo, sin tocar la partida.
- **Lo oculto no viaja** (`Sincro.vistaPara`): las acciones libres, la reserva
  y el equipo del otro que no estén revelados van como `?1`, `?2`… según su
  sitio; las opciones de una elección que apunten a ellas llevan la misma
  marca y el anfitrión la traduce (`sesion.marcas`). La pregunta del OTRO
  llega sin texto de opciones (pueden nombrar su mano). Revelar una carta la
  hace aparecer con su id en la siguiente foto.
- La foto es genérica (campos del motor sin saber cuáles, referencias `$r`,
  `Set`, `Infinity`), con el registro recortado a 80 líneas: ~6 KB de media.
- Prueba: `tools/pruebas/7-red.js` (dentro de `probar-efectos`): canal falso
  asíncrono con JSON, rechazos, ocultos, Annia revelando por marca y un duelo
  entero de 25 turnos sin un desfase.

**Tanda 3 — la mesa para dos humanos** (`match.js` + sala en `remoto.js`):

- **Tú ya no eres siempre `jugadores[0]`.** `this.yoIdx` (0 contra la IA, en el
  calabozo y como anfitrión; 1 como invitado), `this.tu()` y `this.suyo()`. Se
  cambiaron TODOS los `jugadores[0]/[1]` y `jugadorIdx === 0` de la mesa, y
  `placaDe`/paneles por `yoIdx`. `m.jugadorActivo.esIA` queda SOLO para la
  cadena de la IA (`pintar`, `pasoIA`); «es el turno del otro» es
  `m.jugadorActivo !== this.tu()`. Las flechas de sangre llevan el índice real
  del jugador (`data-jugador`), no 0/1 por lado.
  `Recordatorios.yoIdx` dice cuál de los dos humanos eres (la mesa lo pone y
  lo quita).
- **Modo `remoto`** (`params.modo === 'remoto'`, `rol`): el anfitrión crea los
  dos jugadores con los equipos que acordó la sala y pone
  `DueloRed.anfitrion`; el invitado usa `DueloRed.invitado` como `this.motor`
  y no pinta hasta la primera foto (`m.listo`). **Saludo `listo`**: el espejo
  lo manda al crearse y el anfitrión le reenvía la foto (la primera sale antes
  de que exista la mesa del invitado).
- En remoto **no hay Herramientas** (ni pestaña), los ± y las flechas de
  sangre solo en lo tuyo, y en el invitado los atajos, el dado y «aplicar» van
  por `m.intento(...)`. **Solo resuelve sola el golpe quien ataca**; quien
  encaja tiene «Encajar» (si no, los dos PC lo mandarían). La placa de
  elección del invitado se esconde al responder hasta la foto siguiente
  (`responder()`, `eleccionEnviada`): un doble clic contestaría también la
  pregunta que viene detrás (revelar 2 de 2).
- **Anuncios por su `n`**, no por la longitud del array: al invitado le llegan
  recortados y la longitud deja de crecer.
- La mano del rival usa el **reverso oficial** (`.dorso-oficial`,
  `reverso.webp`), como pidió Oscar para las partidas contra personas.
- Si se corta o el rival sale a media partida: «Duelo interrumpido»
  (`rivalDesconectado`). Al salir de la mesa se suelta todo y se cierra la sala.
- **Sala de espera** (`remoto.js`): al conectar, cada uno elige estirpe; se
  manda `{ tipo: 'lobby', raza, equipo }` con su último equipo guardado de esa
  estirpe (`Screens.partida.equipoPara`). El anfitrión lo valida
  (`equipoValido`, si no, el predeterminado) y su «Comenzar duelo» manda
  `empezar`; los dos navegan con `mantener = true` para no cerrar la sala.
  Abre siempre el anfitrión.
- Prueba: `medir-duelo-remoto.js` en el scratchpad: dos ventanas juegan a
  clics hasta el final (6 turnos, 0 desfases) y una desconexión a mitad. Las
  capturas fuera de pantalla, con el evento `paint` (`capturePage` daba
  fotos viejas o negras).

**Tanda 4 — revancha, reconexión, relé y equipos:**

- **Reconexión** (`red.js`): un canal que se cae SIN `adios` (o 8 s sin
  ninguna noticia del otro: `MS_SIN_RESPUESTA`, vigilado en el intervalo del
  ping) pasa a `reconectando`. El anfitrión reabre la MISMA sala y solo admite
  de vuelta al mismo rival (`_rivalSenal`); el invitado vuelve con su MISMO id
  y reintenta cada 2,5 s (EXPIRE / ID-TAKEN mientras el otro no ha vuelto)
  hasta `MS_RECONEXION` (60 s); si no, `error`. La partida no se pierde: el
  anfitrión la conserva y el espejo pide la foto (`listo`) al volver a
  `conectado`; las intenciones en el aire se resuelven `{ ok: false }`. La
  mesa pone un velo (`.aviso-red`) mientras tanto. Medido con un corte brusco
  (`pc.close()` en el invitado): reconectados en ~5,6 s, con lo ocurrido
  durante el corte ya en la mesa.
- **El `adios` sale antes de cerrar** (`cerrar()` cierra el canal 250 ms
  después): si no, el otro lo tomaba por un corte y se ponía a reconectar.
- **Revancha** sin cerrar la sala: los dos la piden (`revancha`), el
  anfitrión arranca otra con `abre` alternado (`motor.turnoDe = 1` antes de
  `iniciar()`) y manda `empezar`; la mesa del invitado lo escucha. **Volver a
  la sala** (`sala`) lleva a los dos a la sala con la conexión viva; la sala,
  al abrirse conectada, manda su elección con `pide: true` y el otro contesta
  (si no, el que llega primero no recibiría nada). `mantenerRed` evita que
  `destruir()` cierre la sala en esos viajes. La sala recuerda estirpe y
  equipo elegidos.
- **Equipo**: en la sala, un desplegable con los equipos guardados de esa
  estirpe (por defecto el último, como contra la IA) y el predeterminado.
- **Relé TURN opcional** («Opciones de conexión» de la sala, guardado en
  `perfil.releRemoto`, `Red.ponerRele`): para las redes que no conectan
  directo. NO viene ninguno de serie (no hay uno público y gratuito fiable);
  el aviso de fallo sugiere relé o Radmin VPN / Tailscale.
- Prueba: `medir-tanda4.js` en el scratchpad.

**Respaldo por Supabase Realtime (19-nov).** Entre un teléfono y un PC lo
directo fallaba siempre, en la misma wifi o no («No se pudo conectar»): wifi
que aísla a los dispositivos (el PC estaba en 192.168.137.x, una red
compartida desde Windows) o datos móviles con NAT compartido. Las pruebas de
las tandas eran entre dos ventanas del MISMO PC, donde lo directo siempre
funciona. Ahora, si en `MS_DIRECTO` (9 s) no hay canal directo, o el ICE da
`failed`, los dos pasan solos a `CanalRele`: Supabase Realtime (broadcast,
protocolo Phoenix a mano, sin librería) con el tema `aeternum-<código>`. Imita
a un RTCDataChannel, así que `_enganchar`, la partida, la revancha y la
reconexión no cambian. Se abre cuando cada uno oye el saludo del otro; al
cerrarse avisa (`adios-rele`). La conexión dice «(por el servidor de
respaldo)». **Cifrado de extremo a extremo**: cada lado manda una clave
pública ECDH (P-256) en su saludo y los dos derivan una AES-GCM que solo ellos
conocen; Supabase y quien sepa el código ven solo texto cifrado (como el canal
directo, que ya cifra WebRTC). Cifrar/descifrar es asíncrono: colas para no
desordenar, y lo que llega antes de abrir espera (`_abierto`; si no, el
«hola» con el nombre se perdía). Proyecto de Supabase de Oscar
`ywgxhqwrhexocpygjtlh`, clave PUBLICABLE (`sb_publishable_…`, va en la URL;
como no es un JWT NO se manda como `access_token`). Medido contra el real:
conectan en ~5 s, ping ~250-290 ms. Configuración: `Red.SUPABASE = { url, clave }` (la clave «anon»,
pública por diseño); sin ella no hay respaldo y sale el aviso de siempre. La
CSP permite `wss://*.supabase.co`. Prueba: `probar-rele.js` del scratchpad,
con un imitador local de Realtime y los CANDIDATE tirados (conectan en ~4 s).

## Versión web (Vercel, dentro de aeternumtcgchile.fun/juego)

- `vercel.json` (raíz): Vercel publica `src/` tal cual, sin instalar
  dependencias (Electron pesa) ni compilar. Proyecto de Vercel aparte, desde
  el repo `ChuGiOhYT/Card-Game`; el sitio principal lo muestra en `/juego`
  con una regla de rewrite (más una redirección `/juego` → `/juego/`: las
  rutas del juego son relativas y sin la barra final no cargaría nada).
- `plataforma.js` en el navegador: `html.web`, guardado en localStorage, sin
  botón Salir, TCG Arena en otra pestaña; en un teléfono (táctil y pantalla
  pequeña) la misma escala que la APK y un aviso de girarlo en vertical.
- El duelo remoto funciona igual entre navegador, .exe y APK (mismo código).
- Probar en local: configuración `aeternum-web` del panel (puerto 8840).

## APK para Android (`movil/` + `COMPILAR_APK.bat`)

- **El juego es el MISMO `src/`**: `movil/` solo es el envoltorio Capacitor 7
  (la misma receta que la Enciclopedia Bíblica: android-35, JDK 21 de
  `%USERPROFILE%\.jdks`, SDK en `%USERPROFILE%\Android\Sdk`). **No en
  AppData**: lo que se ve en `%LOCALAPPDATA%\Android\Sdk` desde Claude está
  virtualizado y el cmd de Oscar no lo ve (primer intento: «SDK location not
  found»). El .bat escribe `local.properties` en cada compilación. Tiene su propio
  `package.json` para no meter Capacitor en las dependencias del .exe
  (electron-builder empaqueta las `dependencies`). `webDir` es `../src`.
- **`COMPILAR_APK.bat`** (lo ejecuta Oscar): `npm install` la primera vez,
  `cap sync android` (copia `src/` a `android/app/src/main/assets/public`),
  `movil/preparar-web.js` y `gradlew assembleDebug` → `dist\AETERNUM.apk`
  (de depuración: se instala a mano, no va a la Play Store; para eso habría
  que firmar una versión release).
- **`src/js/plataforma.js`**, el primer script de `index.html`: en el teléfono
  (`Capacitor.isNativePlatform()`) pone un `window.gameAPI` equivalente al de
  preload.js — guardado en `localStorage` del WebView (privado de la app; se
  borra al desinstalar), salir con el plugin App, TCG Arena al navegador —, y
  conecta el botón ATRÁS (cierra lupa grande/confirmación/mezclador, si no
  pulsa el «←» de la pantalla; en el menú sale). En Electron no hace nada.
- **Pantalla**: la mesa pide ≥1024×700 y un teléfono en horizontal tiene
  ~915×412 CSS px. `MainActivity` activa el «viewport ancho» del WebView y
  `plataforma.js` pone `<meta viewport width=N>` con N = el ancho que deja
  720 px de alto con la forma de esa pantalla (1600 en un 20:9). El WebView
  escala todo para que quepa. **Se diseña a 540 de alto** (`ALTO_MINIMO`;
  ancho mínimo 1024): con 720 todo salía a ~0,57 y los textos eran ilegibles
  (Oscar); con 540, ~0,76 y caben todas las pantallas gracias a una capa
  `html.movil` en styles.css (al final): márgenes y cabeceras compactos,
  entradilla a 2 líneas, el «Entrar» del calabozo pegado abajo (sticky), el
  constructor desplazándose en una sola columna (sus rejillas encogidas
  pisaban filas) y el lateral de la mesa SOLO con la carta (270 px, sin
  registro ni pestañas: lo pidió Oscar). Medido emulando 915×412:
  diseño 1200×541, sin desbordes. Va siempre en horizontal
  (`sensorLandscape`), pantalla completa, sin apagarse, y con audio sin
  esperar un toque.
- **Vídeos**: Android pinta un cuadro negro con la flecha de «reproducir»
  antes del primer fotograma. `MainActivity` pone su propio
  `BridgeWebChromeClient` con `getDefaultVideoPoster()` = 1 px transparente.
- **Táctil**: tocar = clic (y `mouseenter`, así que la lupa del lateral se
  llena al tocar); **mantener pulsado** = `contextmenu` = lupa grande, que ya
  existía para el clic derecho.
- **CSP**: en WebViews viejos Capacitor inyecta su puente como `<script>` en
  línea, que `script-src 'self'` bloquearía. `preparar-web.js` añade
  `'unsafe-inline'` SOLO en la copia de la APK; el .exe sigue estricto.
- Ícono y arranque: `python movil/iconos.py` (de `build/icon.ico`, la gota).
- Probar en PC sin compilar: Electron con `Emulation.setDeviceMetricsOverride`
  (`mobile: true`) DESPUÉS de cargar y recargando, más un `window.Capacitor`
  falso en un preload con `contextIsolation: false`. Trampa:
  `enableDeviceEmulation` o el debugger enganchado ANTES de la primera carga
  tumban Electron sin ningún mensaje.

## Trampas ya pisadas

**Un despliegue por turno** (`motor.desplegoEsteTurno`, se limpia al cambiar
de turno). Sin tope se podía cambiar el personaje en posición sin fin, y cada
cambio disparaba la Retirada de Sadash: victoria instantánea con los espíritus
acompañantes (Oscar). Vale para sacar a alguien O cambiarlo, no las dos cosas.
Los efectos que ponen a alguien en posición (Luh, Escape, Encadenar) y las
llamadas con `saltarFase` no cuentan. La mano dice «ya desplegaste» y apaga
tus personajes. Prueba: `tools/pruebas/6-reglas.js`.

**Con una pregunta tuya en el aire, la mano se apaga.** El motor rechaza
`desplegar`/`equipar` mientras haya `eleccionPendiente`, pero la mano seguía
brillando: contra el jefe del Bosque, Erem preguntaba «+3 o revelar» al entrar
en la fase de acción y la carta de acción «no se dejaba clicar» sin decir por
qué (Oscar). Ahora `preguntaTuya` apaga las dos manos y pulsar una carta llama
a `recordarEleccion()`: la placa se sacude y dice «Responde primero» DENTRO de
ella (un emergente de la banda quedaba detrás de la placa).

**Una partida que acaba sin `notificar()` deja la mesa congelada.** `derramar()`
no notifica, y `finalizarTurno()` —el derrame de 1 de fin de turno— y
`siguienteFase()` —el cobro de Inmolación— salían con `return` al ver la
partida terminada, SIN avisar a la pantalla: la mesa se quedaba en «Fin de
turno», con el duelo ya ganado, sin cartel y con un botón que no hacía nada.
Con las oleadas a 30 de sangre casi no pasaba; con la etapa 1 del Bosque a 5,
pasaba en el primer turno (Oscar: «no me deja finalizar el turno»). Las dos
salidas notifican ahora. Si añades otra vía que pueda acabar la partida,
que notifique.

**El panel de vista previa sirve JavaScript cacheado.** Perdí un buen rato
persiguiendo fallos que no existían. Para verificar cambios de JS, usa
Electron con un script de prueba, no el navegador del panel.

**En los scripts de prueba, usa rutas con barra normal** (`C:/Users/...`).
Y créalos con la herramienta de escritura, **nunca con un heredoc de bash**:
se come las contrabarras y Electron acaba cargando un archivo inexistente.

**Mata los Electron colgados** antes de repetir una prueba fallida. Bloquean
el perfil y provocan errores de caché que parecen fallos del código:
`Get-Process electron | Stop-Process -Force`.

**El `.exe` no se actualiza solo.** Tras cualquier cambio hay que lanzar
`npm run dist`, o seguirás probando la versión anterior.

**El sonido de los botones se engancha una sola vez, no pantalla a pantalla.**
`app.js` instala un único oyente de clic sobre `document` **en fase de
captura**, y `core/audio.js` reproduce la pista. La captura no es un capricho:
así `Router.actual` todavía apunta a la pantalla donde se pulsó, y un botón
que saca de la partida («Abandonar») suena con la pista de la partida y no
con la del destino. Si lo pasas a fase de burbuja, eso se rompe en silencio.
Suena `boton-partida.wav` (a 0.35) dentro de la partida y `boton-menu.mp3`
(a 0.7) en todo lo demás. Cada disparo clona el `Audio` para que dos clics
seguidos no se corten entre sí.

**Los sonidos de la mesa se deducen del estado, no de los botones.**
`posicion`, `accion` y `ataque` los dispara `Screens.partida.sonarSucesos()`
comparando cada repintado con el anterior. Se hace así por dos razones: las
jugadas de la IA no pasan por ningún clic, y un ataque se resuelve desde tres
sitios distintos. Consecuencias que conviene no romper:

- **Suenan para los dos bandos**, a propósito: el turno del rival se juega fase
  a fase y estos avisos son parte de poder seguirlo.
- **El primer pintado solo toma la foto**, sin sonar; si no, lo que ya hubiera
  en la mesa se dispararía de golpe al entrar. Por eso `this.eco` se pone a
  `null` en `render()`.
- **La cuenta de ataques solo vale dentro del mismo turno**, porque
  `atacaronEsteTurno` se limpia al cerrarlo. De ahí que la comparación use el
  número de turno como parte de la foto.
- **`sonarSucesos()` va antes del corte por partida terminada**, o el golpe que
  cierra el duelo se quedaría mudo.
- Los nombres de archivo van **sin acentos ni mayúsculas** (`posicion.mp3`, no
  `Posición_sound.mp3`): son rutas que acaban dentro del `.asar` servidas por
  `file://`, y no es sitio para jugarse la codificación.

**El volumen de cada pista es la mezcla de diseño; el jugador mueve un mando
por grupo que la multiplica.** Los números de `PISTAS` y `MUSICA` son el
equilibrio entre unas y otras, afinado a oído, y **no se tocan desde la
interfaz**. Encima van tres mandos —`musica`, `botones`, `efectos`— de 0 a 1,
que se guardan en `perfil.volumenes`. Con los tres al 100% suena exactamente
como está mezclado, así que añadir el mezclador no cambió una sola mezcla.

Cada pista de `PISTAS` declara su `grupo`; las de `MUSICA` son todas del grupo
`musica`. Al añadir una pista nueva hay que ponerle su `grupo` o se quedará
fuera del mando que le toca. El volumen final se calcula **en el momento de
reproducir** (`volumenDe`), no al precargar: así un cambio de nivel afecta al
siguiente disparo sin tener que reconstruir nada. La música es la excepción,
porque ya está sonando: `aplicarNiveles()` le empuja el volumen en el acto.

El panel (`ui/mezclador.js`) guarda al **soltar** el deslizador, no al
arrastrarlo: al arrastrar solo aplica. Si no, un solo gesto serían decenas de
escrituras a disco. Y al soltar suena una muestra del grupo, que es la única
forma de saber si el nivel que has puesto es el que querías.

**La música es lo contrario de los efectos: no se clona, se sostiene.** Los
efectos clonan su `Audio` para poder solaparse; la música tiene un único
elemento vivo (`_musica`) porque hay que poder pararla. Va en `MUSICA`, aparte
de `PISTAS`, y la maneja la pantalla que la pide: la arranca en `render()` y la
suelta en `destruir()`, que es lo que llama el Router al cambiar de pantalla.
Hoy hay seis piezas: `inicio` en el menú (0.5), `batalla` en la partida (0.4,
más baja porque ahí compite con los sucesos de la mesa, que son información y
no adorno) y **un tema por estirpe** (0.5). El relevo entre todas sale gratis de
ese par arrancar/soltar.

**Las claves de los temas de estirpe SON los ids de raza.** `desterrado`,
`lunaria`, `oxitron` y `reanimado`, para que `ponerMusica(razaId)` funcione sin
tabla de traducción. Los archivos se renombran al copiarlos
(`desterrados_sound.mp3` → `desterrado.mp3`): manda el id, no cómo llegó el
archivo. Lo pone `Screens.seleccionRaza.seleccionar()` —sigue a la estirpe que
se está mirando, disponible o no, igual que el fondo— y `Screens.historia` lo
repite; como `ponerMusica` no reinicia la pieza que ya suena, pasar de la
selección al calabozo no corta la música. Esa llamada de `historia` solo hace
falta cuando se entra por otra vía, como volver de una etapa.

Salir desvanece en medio segundo, porque el corte seco canta muchísimo. Ojo al
detalle: `quitarMusica()` suelta la referencia **en el acto** y deja el
desvanecido corriendo por su cuenta, así que durante ese medio segundo la pieza
vieja se apaga mientras la nueva ya suena. Es un cruce corto, no un fallo; si
algún día molesta, el sitio es `quitarMusica`, no las pantallas.

Y una que puede morder en el futuro: **Chromium puede exigir un gesto del
usuario antes de dejar sonar audio con volumen.** El vídeo del menú se libra
porque va `muted`; la música no tiene esa suerte. Hoy autoarranca sin gesto y
por eso `main.js` no toca `autoplayPolicy`, pero si algún día deja de sonar al
abrir, esa es la sospecha antes que el archivo. `_arrancar()` ya reintenta con
el primer clic o tecla por si acaso.

**Nunca metas un `url()` dentro de una variable CSS.** Un `url()` en una
custom property se resuelve **relativo a la hoja de estilos**, no al
documento. Como `styles.css` vive en `src/css/`, una ruta `assets/fondos/x.jpg`
pasada por variable acaba buscándose en `src/css/assets/fondos/x.jpg`: no
carga, no hay error en consola y el elemento se pinta transparente, así que
parece un problema de z-index o de opacidad. Las imágenes van en el `style`
en línea del elemento (`background-image:url('assets/...')`), que sí resuelve
contra el documento. Ver `.fondo-estirpe` y `Screens.seleccionRaza`.

**El fondo de ambiente es opcional, por raza, y va en `RACES[x].fondo`.**
Lo tienen las cuatro estirpes jugables (`assets/fondos/<raza>.jpg`); los
mercenarios no, por no ser una raza seleccionable. Se pinta a
tamaño de ventana con los bordes difuminados, en selección de estirpe, en el
calabozo y en las partidas **de historia** —un duelo del modo solo se queda
con el fondo neutro—. La raza que no lo tenga simplemente no lo pinta.

**Y puede ser animado: `RACES[x].fondoVideo`.** Lo pinta `ui/ambiente.js`, que
centraliza las tres pantallas que lo usan (`html()` para las que lo pintan de
una vez, `aplicar()` para la selección de estirpe, que salta de una a otra según
cuál mires). El archivo va en `assets/video/<razaId>.mp4` — **el id de la raza,
no el nombre del calabozo ni el del archivo original**. Las cuatro estirpes lo
tienen. Siempre en silencio, aunque el archivo traiga pista de audio: a
diferencia del `videoIntro` de los calabozos (que sí puede sonar, ver más
abajo), este es puro ambiente detrás de la interfaz y nunca compite con la
música. Reglas que no conviene romper:

- **La imagen fija sigue haciendo falta** aunque haya vídeo: es el `poster` y el
  respaldo mientras carga el primer fotograma.
- El `<video>` va **dentro** de `.fondo-estirpe` para heredar su opacidad, su
  máscara de bordes y su velo. Como hermano habría que duplicar los tres.
- `muted` es obligatorio, no decorativo: sin él la política de autoarranque de
  Chromium lo bloquea.
- **No llames a `play()` justo después de pintar** — misma trampa que el vídeo
  del menú. `Ambiente.asegurar()` espera a `canplay`.

**El ambiente animado se guarda en MP4, nunca en GIF.** El GIF del bosque pesaba
**74 MB** para 5,76 s; el mismo metraje en H.264 (`-crf 28`) son **304 KB**, 245
veces menos, con la misma resolución y duración, y lo decodifica el hardware en
vez de la CPU. Un GIF así se habría llevado por delante la memoria y el
instalador. Para convertir hace falta ffmpeg, que **no está en el sistema**: se
obtiene con `pip install imageio-ffmpeg` y queda en
`%APPDATA%\Python\PythonXXX\site-packages\imageio_ffmpeg\binaries\`.

**Los retratos flotantes no se repintan como el resto.** `pintar()` corre en
cada cambio de estado y rehace el HTML de los paneles. Si la capa
`#mesa-flotantes` se rehiciera igual, la animación de flotación volvería al
principio a cada clic y el retrato daría un tirón. Por eso
`pintarLadoFlotante()` compara una firma (`uid:imagen`) y solo toca el DOM
cuando cambia quién está en posición. Si añades algo animado y continuo a la
mesa, sigue ese patrón.

**Los recordatorios avisan una vez por burbuja, y luego solo marcan.** Con 16
cartas de «En posición», una burbuja en cada `pintar()` sería insufrible: la
burbuja sale la primera vez de cada recordatorio y a partir de ahí queda el ⚡
en la carta y la ficha del panel lateral, hasta que pulses «ya está». Dos
detalles que importan:

- **Salir de posición re-arma los recordatorios de esa carta** (`olvidar`), y
  los que llevan `porTurno` vuelven cada turno. Si no, un efecto que se aplica
  en cada batalla se avisaría una sola vez en toda la partida.
- **«Retirada» es lo único que no se deduce del estado**, porque es un cambio y
  no una situación: `observar()` compara con la revisión anterior. Volver a la
  reserva es retirarse; acabar en el Hades es morir, y morir no dispara el
  efecto. De ahí que se distinga por dónde acabó la instancia.

El ⚡ de la carta cae **debajo del retrato flotante**, que va en z-index 7 por
encima de las cartas. Se lee porque el retrato está a `opacity: 0.65` y la
pastilla del distintivo es opaca con borde dorado; medido, los rectángulos se
solapan en los dos casos (personaje y acción). Si algún retrato nuevo trae arte
densa justo en esa esquina, el distintivo se apagará: entonces habrá que
subirlo por encima de la capa flotante, no bajar el retrato.

**No hay burbuja durante el turno de la IA, con una excepción: cuando te está
atacando.** La cadena de fases del rival no se interrumpe, pero un ataque
declarado y sin resolver es de hecho tu turno —el motor no avanza con
`ataquePendiente` puesto—, y es justo cuando las defensivas de «Fase de
combate» importan. La condición es `ataquePendiente && jugadorActivo.esIA`.

**Las primitivas más usadas están en la mesa, no solo en Herramientas.** Subir
o bajar ⚔/🛡 exigía abrir el panel, elegir el objetivo en un desplegable y
pulsar: tres pasos para la operación más frecuente del juego, con el panel
encima escondido detrás de otra pestaña. Ahora hay atajos:

- **`atajosDeCarta()` pega `⚔ ▲▼` y `🛡 ▲▼` a cada carta en posición**, en los
  DOS lados —hay efectos que recortan al rival, y Herramientas ya dejaba
  apuntarle—. El objetivo es implícito, que era el paso que más estorbaba.
- **El dado vive en la banda central**, en el esqueleto que `pintar()` no
  reescribe, así que el último resultado aguanta los repintados sin tener que
  conservarlo a mano como hace `#h-dado`.
- **Y un `↺` para deshacerlos.** No lo pide ninguna carta —no aparece en el
  recuento del mazo—, lo pide **haber puesto el ±1 a un clic**: equivocarse es
  ahora mucho más fácil que antes, y sin esto rectificar obligaba a volver a
  Herramientas, que es justo el viaje que los atajos venían a ahorrar. Llama a
  `Manual.limpiarModificadores` y se apaga cuando no hay nada que quitar.
- **`flechasDeSangre()` mete las flechas EN EL HUECO ENTRE DOS PILAS.** Las
  tres operaciones del reglamento son traslados entre pilas contiguas, así que
  puestas en el hueco se explican sin leer el verbo:

  | | |
  |---|---|
  | Vida → Energía | derramar |
  | Vida ← Energía | recuperar |
  | Energía → Fuera | pagar |

  El hueco Energía\|Fuera lleva **una sola flecha** a propósito: la sangre
  pagada sale del juego para siempre, y una flecha de vuelta mentiría sobre la
  regla. Y se **deshabilitan** cuando no hay de dónde sacar —el motor ya lo
  rechaza por su cuenta (`pagar()` devuelve false sin energía; `derramar()` y
  `recuperar()` recortan a lo que haya)—, lo que de paso enseña la regla sola:
  al empezar el duelo, con 30/0/0, la única encendida es derramar.

  Ojo: ninguno de los tres notifica por su cuenta, de ahí el `notificar()` del
  manejador; y `derramar()` puede terminar la partida.

**La mesa se ve en diagonal.** `.mesa-plano` envuelve los dos paneles, la
banda central y la capa de retratos, y se inclina con
`perspective(1300px) rotateX(20deg)` (variables `--mesa-perspectiva` y
`--mesa-inclinacion`): el lado rival queda al fondo y más pequeño. Los
retratos van DENTRO del plano a propósito: un transform crea su propio
contexto de apilado, y con los retratos fuera (z 7) los atajos de la carta
(z 8, dentro) quedaban otra vez debajo de ellos. Inclinados 20° se encogen un
6%, no se nota. Los avisos (turno, jefe) siguen fuera y planos. Clics,
burbujas y números de golpe usan getBoundingClientRect y siguen cayendo en su
sitio; medido con elementFromPoint en 1280×800 y 1024×700, sin desborde.

**La dificultad del calabozo se regula con la VITALIDAD de la oleada**, no con
sus cartas: `etapa.sangre` en `data/dungeons.js` es la sangre con que empieza
(30 si no se dice). `crearJugador` la recibe como `opciones.sangre` y la guarda
en `j.sangreTotal`, que es lo que usan la barra y el «de N» del panel. Las
criaturas conservan sus números impresos: Oscar descartó tocarlos.

Los cuatro calabozos la tienen. Medido con la IA jugando por ti con el equipo
de historia (200 duelos por etapa), % de victorias antes → ahora:

| Calabozo | sangre por etapa | antes | ahora |
|---|---|---|---|
| Bosque | 5 · 8 · 10 · 15 · 20 · 30 | 1/5/0/4/100/72 | 80/79/100/81/100/64 |
| Oasis | 12 · 15 · 12 · 12 · 12 · 8 | 48/65/0/0/32/11 | 91/97/100/93/94/68 |
| Forjas | 3 · 5 · 10 · 12 · 5 · 8 | 0/15/0/0/0/12 | 70/90/100/84/89/66 |
| Catacumbas | 10 · 15 · 12 · 8 · 10 · 8 | 0/45/0/0/0/0 | 100/94/92/100/76/58 |

Objetivo usado: ≥80% en las etapas 1-2, ≥75% en la 3-5 y ~60-65% el jefe.
Las curvas NO son crecientes a propósito: cada etapa lleva lo que necesita su
cruce de equipo contra oleada. La etapa 1 de las Forjas va con 3 porque Pip
(1/4) no hiere nunca a un Rocoso 4/4: se gana aguantando a que se desangre. El
buscador vive en el scratchpad (`afinar-sangre.js`): prueba de mayor a menor y
se queda con la primera sangre que llega al objetivo. Quitarle a la
oleada el texto de sus acciones NO arreglaba la etapa 1 (7%) y la alargaba de 2
a 7 rondas: Annia (3/2) no supera nunca a unas ratas 4/4, así que la salida es
que se queden sin sangre antes.

**Los atajos de la carta son ahora un abanico redondo.** Cada carta en
posición lleva UN botón redondo (±, dorado si tiene modificadores); al pulsarlo
salen en arco cinco pequeños: ⚔+ ⚔− ↺ 🛡+ 🛡−. Sigue abierto mientras ajustas
(se recuerda en `atajoAbierto` por uid, así los repintados lo pintan ya
abierto y sin repetir la animación: las transiciones no corren en elementos
nuevos) y se cierra con otro clic, tocando fuera o con Esc. El ángulo va en el
HTML como coseno/seno sin unidad y el radio en CSS (`--abanico-r`, menor bajo
760 px de alto). **El sitio del abanico se reserva siempre** con `margin-right`:
`.lado-campo` desplaza en horizontal y lo que sobresalía se recortaba —se veía
el × pero ningún pequeño, y salía una barra de scroll—.

Del mismo lote: dado, sonido y flechas de sangre redondos; Abandonar es un
círculo «←» que se abre en cápsula al pasar el ratón; las pestañas del lateral
son iconos redondos (📜 🛠 ⚡) y la activa se estira y dice su nombre; la
cuenta de recordatorios es una pastilla (`.pestana-num`, ya no se reescribe el
texto de la pestaña). Siguiente fase y los botones de la burbuja, en cápsula.

**Aviso de cambio de turno** (`mostrarAvisoTurno`): «Tu turno» / «Turno de …»
1,1 s en el centro del tablero, colgado de `turnoNuevo` en `detectarSucesos()`
(y en el primer pintado, para anunciar quién abre). Vive en el esqueleto, no en
los paneles, y no recibe clics: no para la cadena de la IA.

**Números de golpe, sangre que baja y cartas que entran.** Todo colgado del
mismo detector (`detectarSucesos`, que ahora también devuelve `nuevosActivos` y
`nuevasAcciones`):

- **`numerosDeGolpe()`**: «−5» rojo sobre quien encajó, «Destruido», el reflejo
  en dorado sobre quien atacó y «Sin daño». Se cuelgan del `.mesa-tablero`
  directamente —no de los paneles—, así que los repintados no los tocan.
- **`animarBarras()`**: `.seg` ya tenía `transition: width`, pero NUNCA se veía,
  porque `pintar()` crea la barra nueva directamente con su ancho final. La
  cura: `medirBarras()` lee el ancho REAL en pantalla justo antes de rehacer
  los paneles; después se pone la barra nueva en ese ancho y se la deja
  transicionar al suyo. Al medir el ancho real, un repintado a mitad de camino
  sigue desde donde iba. No hizo falta dejar de rehacer el panel.
- **`pintarVivas()`**: destello al entrar en posición (`entra-campo`) y al
  acoplarse una acción (`acopla-accion`), con el mismo retraso negativo que
  `pintarGolpe()` para sobrevivir a los repintados.

**Placa, mano en abanico y dado dibujado (ideas tomadas de Eterrion).**

- **Placa** (`placa()`): avatar redondo con marco dorado —quien da la cara: el
  personaje en posición, o el primero que espera; su busto flotante si lo
  tiene, si no el arte de la carta—, el emblema de la estirpe en una pastilla y
  el nombre. Brilla en dorado en el turno de ese lado. Sustituye al sigilo
  suelto de `.lado-info`.
- **Mano en abanico**: cada carta lleva `--giro` y `--alto` (los pone
  `pintarControles` según su distancia al centro) y se solapan; al pasar el
  ratón sube, se endereza y se pone delante. Las que puedes jugar AHORA
  brillan y laten; las demás, apagadas.
- **Dado dibujado** (`.dado[data-v]`, 3×3 huecos de puntos en CSS): rueda
  cambiando de cara al azar y al caer deja un destello dorado (`.dorado`,
  0,9 s). **Rueda con CUALQUIER tirada**, no solo la del botón:
  `Manual.dado()` deja `motor.ultimaTirada = { n, resultado }` y
  `rodarSiHuboTirada()` lo mira en cada `pintar()`. Así se ve el dado de Finta,
  el de la IA y el de Krag/Krox. Se fue el número suelto `#mesa-dado-valor`.

**La mesa es un tapete pintado, y las placas viven fuera de ella.**

- **Tapete por estirpe** (`tools/fondos2d/tapetes.py` → `src/assets/tapetes/
  <raza>.webp`, 30-90 KB): tierra y pasto (desterrados), placas de hierro con
  grietas de fuego (oxitron), arena y cristal bajo la luna (lunaria), losas de
  cripta con huesos y musgo (reanimados). Paletas MEDIDAS de `fondos/<raza>.jpg`
  (oscuro, mediano, claro). Va de fondo de `.mesa-plano` (inclinado, así que
  se ve como un suelo), elegido por la estirpe del jugador (`estiloTapete`),
  con el url EN LÍNEA (en variable CSS no cargaría). Los paneles ya no tienen
  fondo propio: son el tapete.
- **Zonas encima, en CSS** (su sitio depende de la ventana): el **círculo de
  runas** (`RUNAS`, un SVG con 16 runas, estirado en elipse: con la mesa
  inclinada se lee como un círculo en el suelo) bajo el personaje en posición,
  o solo con «Posición» si no hay nadie; se enciende en dorado cuando a ese
  lado le toca elegir personaje (`zonaEncendida`). El **hueco de la acción**
  (`.hueco-accion`, se enciende en la fase de acción) y la **casilla del
  Hades**, que ahora está siempre (vacía y punteada si no hay nadie).
  `.lado-campo` pasó a `overflow: visible` —un solo puesto por bando en todos
  los modos—: recortaba la elipse y sacaba una barra de scroll falsa.
- **Placas con la sangre dentro** (`placaConSangre`), en el esqueleto y planas:
  `#placa-rival` encima de la mesa y `#placa-jugador` entre tus dos manos.
  Llevan las MISMAS clases de antes (`sangre-barra`, `sm-energia`, flechas…),
  así que solo cambiaron los selectores que las buscaban en el panel:
  `medirBarras` (ids de placa), el destello de sangre y el embiste a la
  sangre (`placaDe(idx)`), la red de los números de golpe y tres anclas del
  tutorial. Compactas a propósito (~85 px): más altas, la tuya tapaba tus
  cartas. Medido en 1024×700 y 1280×800: 0 de desborde y 0 px de solape con
  tus cartas o con la mano de acciones.

**La mesa ocupa todo el hueco** (pedido de Oscar con flechas sobre una
captura): `.mesa-plano` con `flex: 1` y los dos lados repartidos
(`space-between`), perspectiva más suave (2200px, 17°) e inclinada desde el
borde de ARRIBA (`transform-origin: 50% 0%`), que queda pegado a la placa del
rival —inclinada desde abajo, ese borde se hundía y dejaba una franja vacía—.
Lateral más pegado (`column-gap: 10px`). La placa del rival asoma sobre el
borde de arriba (margen negativo) y la tuya baja 12 px bajo las manos para no
rozar tus cartas (medido: 0 px de solape en 1024×700, 1194×728 y 1280×800).
`.mesa-tablero` pasó a `overflow: visible`: lo único que asomaba eran 8 px de
las cartas giradas del abanico, y recortarlas era peor.

**La mano del rival, oculta** (`pintarManoRival`): una fila de esqueleto
arriba, espejo de la tuya —reversos de sus personajes en reserva a la
izquierda, de sus acciones libres a la derecha, su placa en medio— y con la
cuenta en el rótulo («Acciones 8»). El reverso es CSS (`.dorso-carta`: oscuro,
marco dorado, el `RUNAS` y el emblema de su estirpe); no hay arte de reverso en
los recursos. Cuelgan hacia la mesa (giro desde arriba). **El reverso oficial
existe** (`src/assets/cartas/reverso.webp`, esquinas transparentes, 300×414)
pero Oscar lo reserva para las partidas CONTRA JUGADORES: contra la IA y en el
calabozo van estos dibujados. **Se fue el
«Esperando» de la oleada**, que enseñaba sus criaturas boca arriba: lo pidió
Oscar, ahora solo se sabe cuántas quedan. Las dos filas de manos son una
rejilla `1fr auto 1fr` para que las placas queden centradas.

**Foil y embiste.** Al pasar el ratón por la carta en juego (y por la de la
lupa) se inclina hacia el cursor y la cruza un reflejo irisado (`.foil`,
`--rx/--ry/--mx/--my`, oyente `pointermove` delegado: pintar() rehace las
cartas y el siguiente movimiento engancha a la nueva). En cada golpe el
atacante EMBISTE hacia su objetivo y vuelve (`.embiste`, dentro de
`pintarGolpe` con el mismo retraso negativo); el rumbo se mide una vez en el
primer pintado del golpe (`vivo.rumbo`), porque en los siguientes el defensor
muerto ya no está, y si no hay defensor apunta a la placa rival.

**La mano asoma sobre el borde inferior de tu lado** (`margin-top` negativo en
`.mesa-manos`): con cartas en los dos lados el tablero se pasaba 30-37 px en
1024×700, 1194×728 y 1280×800, y ahora 0. Y `.mesa-tablero` no enseña barra
(`scrollbar-width: none`): el embiste y los emergentes la hacían parpadear.

**Ya no hay barra inferior: todo se declara con mensajes emergentes.** El
`<footer>` de la mesa desapareció y la rejilla es `auto 1fr`. Lo que hay que
ELEGIR va en la **mano**, bajo la mesa y sin inclinar (`.mesa-manos`, en el
esqueleto, hermana de `.mesa-plano`), como la dibujó Oscar: **personajes a la
izquierda** (`#mesa-controles`, la reserva) y **acciones a la derecha**
(`#mano-acciones`, las libres). Las dos siempre a la vista; cada lado brilla y
se puede pulsar solo en su fase, el resto del tiempo va apagado (`.pasiva`). Los
botones viven en la banda central: `#mesa-atacar` (⚔ Atacar, o Resolver /
Retirar / Encajar con un ataque en el aire) y `#mesa-avanzar` (Siguiente fase).
Lo que antes contaba el pie sale en `emergente(texto, { sobre, clase })`:

- `fase` (oscuro): qué toca, una vez por fase y solo si la fase pide algo
  (`avisarFase`; en Personaje espera 1,2 s a que se vaya «Tu turno»).
- `combate` (rojo): el golpe declarado, tuyo o contra ti («⚔ 6 — 6 de daño»),
  desde `revisarResolucion`. Se calcula DESPUÉS de los efectos automáticos:
  mientras `aplicando`, `revisarAvanceAutomatico` no corre, o anunciaría el
  golpe sin el bonus de Finta.
- `efecto` (amarillo): lo aplicado solo, de personajes y de acciones
  (`AccionesIA.aplicar` también anuncia, resumiendo sus líneas del registro).

Los de la banda se relevan (el nuevo quita al anterior) y salen 26 px por
encima de ella, o taparían Resolver. Los de carta se escalonan. Se fueron
`cuerpoDeclararAtaque`, `cuerpoAtaquePendiente`, `bloqueRespuesta`,
`efectoIAParaEsteAtaque` y `conectarRespuesta`: todo lo que se dice más abajo
sobre «el pie» y su desborde es historia. Medido: 0 px de desborde con ataque
pendiente y el turno completo sin clics sigue en ~7,5 s.

**Los efectos ± de PERSONAJE también se aplican solos** (`core/efectosPersonaje.js`,
mismo patrón que `accionesIA.js`, para los dos bandos). Hoy: Annia +1, Axel
+2, Thiana +2 (En posición, al desplegar; dura mientras siga en posición
porque `retirar` pone los modificadores a cero), Erem +3 (en cada fase de
acción suya, hasta fin de turno), Delem +2 daño o +2 defensa según el tipo de
la acción acoplada (se recalcula al cambiarla, `inst.bonoPersonaje`), Krag y
Krox +dado a defensa/daño en cada batalla (`enBatalla`, desde
`declararAtaque`). Los modales («revela … o aumenta …») se quedan con el
aumento; ↺ lo quita si prefieres revelar. Faltan los que escalan con revelados
o Hades (Auram, Lydia, Fälum, Acompañantes, Gurh, Ejército, Thila, Zabar):
ya están, como PASIVOS (`PASIVOS`, `recalcularPasivos` desde `notificar()`,
en `inst.pasivo` que `Combat` suma aparte de `modificadores`, así nunca se
acumulan). Dónde funciona cada uno: `DONDE_PASIVO` (mano revelada, posición o
Hades). Fälum y Zabar eligen «ataque o defensa» según su postura hasta que
exista el sistema de elecciones. Probado caso a caso (`probar-pasivos.js` en
el scratchpad) y en 4.800 duelos IA contra IA sin cuelgues: los reanimados
pasan de ganar 7–26% a 17–35% contra las otras estirpes.

Cada uno deja un anuncio en `motor.anuncios` y la pantalla lo enseña como un
rótulo AMARILLO sobre la carta que sube y se desvanece (`mostrarAnuncios`,
`.anuncio-efecto`, 2,2 s). Lo automatizado ya no sale en Recordatorios.

**Y destapó una trampa de la IA:** `relevarSiConviene` cambiaba al esbirro por
el Eternal en cuanto el esbirro no podía con tu personaje. Con Annia a +1 eso
pasaba siempre y la etapa 6 del Bosque cayó del 67% al 12%. Ahora el Eternal
no releva mientras le queden esbirros (`eternalProtegido`), que es la regla
de «se esconde tras sus esbirros». Consecuencia medida: los cuatro jefes se
ganan al 100% (también con 30 de sangre): su dificultad venía de saltarse esa
regla. Pendiente de decidir con Oscar cómo endurecerlos.

**Duelo ágil: el juego ya no pregunta lo que puede hacer solo.**

- **Tus acciones automatizadas se aplican solas** (`autoAplicar`, en
  `pintar()` justo tras calcular los recordatorios): la ofensiva de combate al
  DECLARAR tu ataque, la defensiva cuando te atacan a esa carta, la de «Acción
  equipada» al acoplarla. Mismo código que la IA (`aplicarManual`). Trampa ya
  pisada: el dado del efecto notifica al motor y repinta a media aplicación, y
  ese repintado la volvía a aplicar en cadena (Finta ×4 y la oleada desangrada
  en un clic). Por eso `aplicarRecordatorio` descarta ANTES de aplicar y hay
  cerrojo (`aplicando`).
- **La burbuja de recordatorio con botones ya no existe**: ahora es un aviso
  de una línea arriba de la mesa (`.recordatorio-aviso`, 5 s, no detiene nada;
  tocarlo abre la pestaña ⚡). Solo sale para lo que aplicas tú a mano; lo
  automatizable ni avisa. `burbujaViva` queda siempre a null.
- **Los ataques se resuelven solos** (`revisarResolucion`, 1,6 s con barra en
  «Resolviendo…» / «Encajando…»), los tuyos y los de la IA contra ti. Tocar la
  mesa la para (`ataqueManual`, por ataque, aparte de `faseManual`) y vuelven
  Resolver/Retirar. Atacando tú, el bloque ya no repite «Por aplicar».
- **El aviso del jefe se cierra solo** al ritmo de lectura (20 car/s, entre 4
  y 12 s) con barra en «Continuar»; tocar el aviso lo deja quieto.

Medido sin un solo clic después de ⚔ Atacar: tu golpe, Fin, el turno entero de
la IA con su ataque contra ti y vuelta a tu fase de Personaje, en 7,8 s.

**Flujo del turno (Oscar, sustituye a lo de abajo sobre personaje y
acción):** desplegar o cambiar al personaje pasa SOLO a la fase de acción
(450 ms, `AUTO_MS_RAPIDO`), y acoplar una acción (o Tilos) pasa sola al
ataque. Si ya había alguien en posición, o la acción venía puesta del turno
anterior, no hay cuenta atrás: el botón de avanzar dice «Mantener posición →» /
«Mantener acción →» (`etiquetaAvanzar`) y se confirma con él. «Puesta en esta
fase» se sabe comparando con la firma de acciones al entrar
(`firmaAccionAlEntrar`). La ÚNICA fase que da tiempo —dados, efectos— es la de
ataque; el fin de turno también pasa rápido. Las preguntas de carta (Annia,
Erem…) siguen parando el paso hasta responderlas. Se quitó el oyente
`pointerover` de la mano, que ya no tenía cuenta atrás que parar. Prueba:
`medir-flujo.js` en el scratchpad.

**Mirar tu mano para la cuenta atrás** (YA NO EXISTE, ver el párrafo
anterior): con alguien ya en posición, la fase de personaje se pasaba
sola en 1,4 s y no daba tiempo a decidir si cambiarlo («contra el jefe no me
deja cambiar»). Y el rótulo de la mano dice tu energía en esa fase
(«Personajes · energía 3»): el aviso vivía en el pie que se quitó, y sin él no
se entendía por qué las cartas de coste alto salen apagadas.

**Las fases avanzan solas cuando ya no piden nada** (`faseCumplida`,
`revisarAvanceAutomatico`, llamada al FINAL de `pintar()`). Personaje: hay
alguien en posición. Acción: todos los activos llevan acción (o no hay activos).
Ataque: no queda atacante libre ni ataque pendiente. Fin: siempre. El botón de
avanzar enseña «Pasando a …» con una barra que se llena (retraso negativo, como
los golpes); 600 ms si acabas de jugar, 1400 ms si la fase empezó ya hecha.
Pulsarlo avanza ya. **Tocar cualquier otra cosa de la mesa la cancela** para
esa fase (oyente `pointerdown` en captura; elegir carta en el pie solo
reprograma). No corre con tutorial abierto, burbuja de recordatorio o aviso del
jefe, y el temporizador lo vuelve a comprobar al disparar: la burbuja sale
DESPUÉS de programarlo.

**«⚔ Atacar» vive en la banda central, a la derecha junto al dado**
(`#mesa-atacar`, en el esqueleto; su contenido lo rehace `pintar()` y el clic va
delegado). No en el centro: las burbujas de recordatorio se anclan a tu carta y
lo tapaban. En 1 contra 1 el pie ya no muestra selectores; con elección real
sigue el «Elige quién ataca y a quién» y el botón usa lo que digan. La burbuja
de recordatorio también ofrece **Aplicar** (`botonAplicar`), no solo el panel.

**Abandonar en historia vuelve al mapa del calabozo**, como ya hacía el botón
del fin de partida; antes mandaba al menú principal.

**El dado rueda antes de enseñar el número, y eso es SOLO adorno.** La tirada
ocurre entera al pulsar —`Manual.dado()` la escribe en el registro al
instante—; lo único que se retrasa es mostrarla (`mostrarTirada`). Medido: a
los 30 ms el resultado ya está en el registro aunque el dado siga girando. Si
la animación fallara, el número sigue estando en el panel.

Cuatro cosas que van juntas:

- **La duración la manda el JS** (`MS_DADO`) y la empuja al CSS como
  `--dado-giro`, igual que `cinematica.js` con sus fundidos: escrita en los dos
  sitios se desincroniza a la primera.
- **Son 420 ms a propósito.** `RITMO_IA` es 620 ms por fase; algo más largo se
  solaparía con el repintado siguiente.
- **Reiniciar la animación exige quitar la clase, forzar reflujo y volver a
  ponerla.** Sin eso, una segunda tirada mientras rueda la primera deja el dado
  quieto aunque el motor SÍ haya tirado. Y un testigo (`nTirada`) descarta el
  resultado viejo, para que dos tiradas seguidas no se pinten en desorden.
- **`prefers-reduced-motion` se respeta en los DOS lados**: el CSS apaga la
  animación y el JS además se salta la espera, o el número tardaría 420 ms en
  aparecer sin que nada se moviera.

**Un detector, dos salidas: `reaccionarASucesos()`.** `detectarSucesos()` hace
UNA vez el diff contra la foto anterior (`this.eco`) y devuelve qué pasó;
`sonarSucesos()` lo convierte en sonido y `animarSucesos()` en movimiento. Se
unificó porque las animaciones necesitaban exactamente la misma señal y por las
mismas dos razones que los sonidos —las jugadas de la IA no pasan por ningún
clic, y un ataque se resuelve desde tres sitios—; con dos diffs habría dos
verdades sobre «qué acaba de pasar». Sigue yendo **antes del corte por partida
terminada**, o el golpe que cierra el duelo se quedaría mudo y quieto.

**El parte del golpe lo deja el MOTOR, con `anotarGolpe()`.** Lo escriben las
**dos** vías que golpean: `resolverAtaque()` —el ataque normal y el de la IA— y
`_golpeAlGrupo()` de los jefes. El método vive en el motor y no en cada sitio
justamente para que el contador sea uno solo. El motor no anima nada: solo deja
el dato (quién golpeó, quién encajó, si murió, cuánta sangre se movió), y la
pantalla decide. Dos detalles que importan:

- Lleva un **contador `n`**, no una marca de tiempo ni el uid: la pantalla
  repinta varias veces por golpe y necesita distinguir «otro golpe» de «el
  mismo otra vez». Dos golpes iguales en el mismo turno se verían como uno.
- Se anota **al final, ya cobrado todo**. Antes, un repintado intermedio
  —`enviarAlHades` notifica— animaría sobre un tablero a medio resolver.

**Y el impacto se REAPLICA en cada repintado, con `animation-delay` negativo.**
Esta es la parte que no se adivina. `pintar()` rehace los paneles enteros y se
lleva la clase por delante —`pasoIA` repinta otra vez justo después de que el
motor resuelva, así que la sacudida moriría a los pocos milisegundos—. Así que
`pintarGolpe()` la vuelve a poner mientras el golpe siga vivo; y para que eso
no la reinicie desde el principio le pasa un **`animation-delay` negativo igual
a lo ya transcurrido**, con lo que el navegador la retoma donde iba. Medido:
tras un repintado a mitad, el retraso pasa de `0ms` a `-219ms` y la animación
continúa en vez de empezar de nuevo. Sin ese truco, cada repintado sería una
sacudida nueva y el golpe duraría lo que duraran los repintados.

El destello de sangre va **aparte** de la sacudida a propósito: el herido no
siempre es el defensor, porque el reflejo del escudo sangra a quien atacó, y
los dos lados pueden encenderse en el mismo golpe.

**Todos los campos del parte son opcionales salvo el daño**, y el golpe del
jefe es la razón: sin nadie en posición no hay defensor al que sacudir (queda
solo el destello), y de un jefe del que no se sabe el bando no se puede decir
quién atacó —`atacanteIdx` se queda en `-1`—. `pintarGolpe()` tolera los dos
huecos. En el mismo caso, el reflejo **solo se anota si se supo cobrar**: si no,
la mesa animaría una sangría que no ocurrió.

El aviso del jefe es modal, así que el primer repintado tras su golpe es el
«Continuar»: la sacudida cae justo al cerrarse el aviso, cuando la mirada vuelve
al tablero. Es tardío a propósito, no un retraso que haya que arreglar.

**Cuidado al probar al jefe**: lanza UNA de sus cuatro al azar, así que una
prueba que llame a `lanzar()` pasa o falla según el dado —llamar a
`_golpeAlGrupo()` directamente es lo determinista, y aparte se comprueba que
la vía se alcanza de verdad—. Y `instanciasJefe()` exige `salioAlCampo`: en la
etapa 6 la oleada saca primero la chusma, así que hay que rotarla hasta que el
jefe asome o no habrá ningún jefe que lanzar nada.

Y el aviso general para lo que venga: **`pintar()` reescribe los dos paneles en
cada cambio de estado**, así que una animación declarada ahí dentro vuelve al
fotograma 0 en cada repintado —el mismo tirón que obligó a `pintarLadoFlotante`
a comparar firmas—. El dado se libra porque vive en el esqueleto. Lo que vaya
dentro de los paneles necesita o la firma, o el patrón de `pintarGolpe()`:
clase reaplicada con retraso negativo, colgada del diff de `detectarSucesos()`.

Tres cosas que no conviene romper:

- **Van por DELEGACIÓN en el contenedor.** `pintar()` rehace `#panel-rival` y
  `#panel-jugador` enteros en cada cambio de estado: un oyente puesto en el
  botón muere en el primer repintado. Por lo mismo, el manejador busca la
  instancia **por uid**, nunca guardando una referencia en el DOM.
- **Llaman a la misma `Manual.modificar` y con el mismo motivo (`'manual'`)**
  que el panel largo. Un atajo no puede dejar un rastro distinto en el registro
  que la ruta que atajó.
- **Crecen a lo ANCHO, no a lo alto.** `.campo-par` y `.mesa-centro` son filas
  flex. Importa porque en esta mesa lo escaso es el alto —las cartas ya se
  encogen en ventanas bajas— y una fila nueva le habría quitado sitio al
  tablero, como avisa la nota del pie. Medido en Electron: el tablero mide
  **577 px con los atajos y 577 sin ellos**, y la mesa no desborda.
- **Van en `z-index: 8`, por encima de la capa de retratos, y con fondo
  OPACO.** El retrato de tu propio lado está desplazado a la derecha justo para
  no taparle la carta al activo… y cae exactamente donde viven estos atajos:
  medido, cubría el **100%** de ellos. Se podían pulsar —la capa es
  `pointer-events: none`— pero no se veían, que para el jugador es lo mismo que
  no existir. La cura es la que ya pedía la nota del ⚡: **subir el control,
  nunca bajar el retrato**, y que se lea solo (fondo opaco + borde dorado, como
  la pastilla del distintivo). Con `rgba(255,255,255,0.04)` de fondo eran
  invisibles incluso sin nada delante.

  Y ojo con cómo se verifica esto: `elemento.click()` **se salta el
  hit-testing**, así que una prueba que pulse por código pasa en verde con el
  control enterrado bajo otra capa. Para ver qué recibiría el ratón hay que
  usar `document.elementFromPoint()`, y para saber si se VE, una captura.

Y una trampa tonta que costó dos arreglos seguidos: **el HTML de estas
pantallas vive dentro de template literals**, así que un backtick en un
comentario —escribir `` `pintar()` `` dentro del bloque— cierra la cadena y
revienta el archivo. En esos comentarios va sin backticks.

**Defenderse no puede exigir buscar la herramienta.** La ventana del ataque
lleva una tira con lo aplicable (`bloqueRespuesta`) y un atajo a Herramientas,
y al declararse el ataque se abre sola la pestaña de Recordatorios, donde sí
cabe el texto impreso entero. Antes el rótulo decía «defiéndete desde
Herramientas» con ese panel oculto detrás de otra pestaña: la respuesta existía
y no se encontraba, que para el jugador es lo mismo que no existir.

**Y lo que hace la IA tiene que verse sin ir a buscarlo.** Sus efectos
automáticos se anotan en `motor.ultimosEfectosIA`, que llena
`AccionesIA.aplicar()` **reutilizando los textos que el propio efecto ya
escribió en el registro** —nunca redactándolos aparte, para no llevar dos
copias del mismo mensaje que se desincronicen—. Dos huecos, uno por momento,
y los pinta gente distinta:

- `.combate` → la ventana del ataque pendiente (`efectoIAParaEsteAtaque`).
  Hace falta porque al declararse un ataque `abrirRecordatoriosSiTeAtacan`
  cambia de pestaña sola y tapa el registro justo entonces. Sin esto, **un dado
  que cae en «sin bonus» se ve exactamente igual que una carta que no hizo
  nada**, que fue el fallo que se reportó jugando.
- `.equipar` → la banda central (`avisoEfectoEquipado`), que comparte hueco con
  la previsión de ataque porque **nunca coinciden**: una es de tu turno y la
  otra del suyo. Va ahí y no en una fila propia por lo del pie: la banda ya
  está en la rejilla y no le quita altura al tablero.

Están **separados a propósito**: en un mismo turno pueden darse los dos, y con
un solo hueco el de combate borraría el aviso de lo que acababa de acoplar.

Sin modal ni clic, a diferencia del aviso del jefe: aquello es una vez por
turno suyo y gordo, esto puede pasar cada turno y obligar a confirmar sería
insufrible. La vigencia la acota `turno`, sin que nadie limpie nada:
`numeroTurno` sube en cada turno de cada bando, así que el aviso se apaga solo.

Ojo al alcance real, que es menor de lo que parece: de las automatizadas, las
de «Acción equipada» son tres —`o_captura`, `o_luna_sangrienta` y `n_ruego`— y
**solo Ruego está en `ACCIONES_CALABOZO`**. O sea que en el calabozo lo único
que llega a la banda central es la IA sangrándose a sí misma; Captura, que es
la que de verdad desconcierta porque te arrastra un personaje a posición, solo
sale en modo solo.

**Cuidado con lo que crece en el pie.** Los controles son la fila `auto` de la
rejilla de `.mesa` y el tablero es el `1fr`: cada píxel del pie sale del
tablero, que a partir de cierto punto se desplaza y te deja sin ver tu propio
lado. La tira es de una línea con el texto en el `title`, y al declararse un
ataque el tablero se asoma a tu lado (`scrollTop = scrollHeight`). Ese scroll
**se reaplica en cada `pintar()`**, no una vez: rehacer el HTML de los paneles
devuelve el scroll a cero.

**Y el pie se recortó hasta que el tablero dejó de desplazarse.** El desborde
era real y estaba concentrado en un estado: con un ataque declarado el pie
llegaba a **224 px** y el tablero se pasaba **111 px** en la ventana por
defecto. Lo que lo arregló, por orden de cuánto ahorró:

| cambio | ahorro |
|---|---|
| `.ap-respuesta` con `order: 1` para que los botones no caigan a una 3.ª fila | ~61 px |
| el rótulo dentro del bloque en vez de una `.controles-titulo` propia | ~23 px |
| `.ap-lado` en línea en vez de apilado | ~22 px |
| miniaturas de elección y relleno del pie con `clamp` por `vh` | ~21 px |

Resultado medido, en las cuatro fases y también con el ataque pendiente y la
tira puesta: **0 px de desborde a 1280×800 y a 1440×900**. A 1024×700 —la
ventana MÍNIMA que permite `main.js`— todavía se pasa ~50 px con un ataque
pendiente, porque ahí el bloque envuelve una fila más por ANCHO, no por alto.
Si algún día molesta, la salida es subir `minHeight`, no seguir encogiendo las
cartas.

Dos avisos para quien vuelva aquí:

- **La fila de elección de personaje es lo que más ocupa del pie**: son
  miniaturas con `aspect-ratio` 1191/1646, así que su ALTO sale del ancho
  (62 px de ancho eran 86 de alto). Encogerlas no quita legibilidad porque la
  carta se lee en la lupa al pasar el ratón, no en esa tira.
- **`@media (max-height: 760px)`** aprieta cartas y números solo en ventanas
  bajas, para no encoger nada en la ventana por defecto, donde ya cabía.

**El registro lleva 80 líneas y se pega al fondo solo.** Eran 14, que en un
turno de jefe —varias habilidades con su detalle— se comían la explicación de
lo que acababa de pasar. El panel ya tenía `overflow-y: auto`; lo único que
faltaba era darle qué desplazar (`LINEAS_REGISTRO`). Tres detalles que van
juntos y se rompen por separado:

- **Se mira si estaba pegado al fondo ANTES de rehacer el HTML**, y solo
  entonces se le devuelve el sitio. Es la misma trampa del tablero: `pintar()`
  reescribe el panel y el scroll vuelve a cero, así que sin esto un historial
  largo dejaría a la vista las líneas **más viejas**, que es peor que las 14 de
  antes.
- **Y solo se re-pega si ya estaba abajo**: si subiste a leer algo, el turno de
  la IA no puede arrastrarte de vuelta. `pintar()` corre varias veces por fase.
- **Un panel `oculto` mide 0×0**, así que mientras está detrás de otra pestaña
  no se le puede poner el scroll: al volver a enseñarlo hay que llevarlo al
  fondo a mano (`registroAlFondo()` desde el manejador de las pestañas). Es la
  misma razón por la que los pasos del tutorial anclados al lateral necesitan
  su `antes`.

Medido en Electron contra `.mesa-lateral` —el ancestro que recorta, nunca
`innerHeight`—: 3376 px de contenido en un hueco de 362 px, sin desbordar.

**Los cambios en la IA se miden, no se suponen.** `tools/simular.js` corre en
Node puro —puede, porque `core/` no toca el DOM— y juega miles de duelos con
equipos aleatorios. Dos avisos aprendidos a base de tropezar:

- **La heurística es determinista.** Con equipos fijos, las mil partidas de un
  cruce son la misma partida mil veces. La variedad tiene que venir de los
  equipos, por eso el banco los genera al azar.
- **Una sola semilla no demuestra nada.** Varias variantes daban 54% con una
  semilla y 51% con otra. Con 1200 duelos el error estándar ronda el 1,5%, así
  que todo lo que no pase de ~53% de forma repetida es ruido. Confirma siempre
  con dos semillas y, si puedes, invirtiendo los bandos.

De todo lo que se probó, solo `accionPorSimulacion` sobrevivió a esa criba
(54-55% en tres semillas). Los demás ajustes de `AI.AJUSTES` siguen apagados
justamente porque no pasaron el corte; están ahí documentando lo ya probado.

**`pesoReflejo` es la excepción: no es un ajuste especulativo, es una regla que
`puntuarAccion` no veía.** Cuando se añadió el reflejo del escudo, esa función
se quedó atrás: contaba `contra.destruido` y `contra.danoSangre` —lo que evitaba
encajar— pero **nunca `contra.danoReflejado`**, que es lo único que se gana
cubriéndose. Consecuencia medida: la IA **no equipaba una defensiva jamás**, así
que Bloquear y Acrobático eran inalcanzables por mucho que estuvieran en el mazo.

Con el reflejo contado a peso 1 (igual que la sangre que saca pegando), la
variante ciega `sinReflejo` pierde **48% / 47% / 49% en tres semillas**: pasa la
criba de sobra. Y los duelos duran algo más (10,3 → 11 turnos), que es
exactamente lo que hace un bando que se cubre.

**Trampa del banco casero: `jugarFase` YA cierra el turno.** En fase `fin`
llama a `finalizarTurno()` y devuelve `false` (`ai.js`, final de `jugarFase`).
Un bucle que interprete ese `false` como «ciérralo tú» y llame otra vez a
`finalizarTurno()` **cierra el turno recién abierto del rival antes de que lo
juegue**: la oleada no despliega, no acopla y no ataca, y el registro muestra dos
«fin de turno» seguidos. Costó una tanda entera de mediciones que parecían decir
que los efectos defensivos no se disparaban. Lo correcto es `AI.jugarTurno()`, o
un bucle que solo resuelva `ataquePendiente`. `tools/simular.js` lo hace bien;
el error fue de un arnés escrito a mano.

**El turno del rival se juega fase a fase, no de golpe.** `AI.jugarFase()`
resuelve solo la fase en curso y devuelve si queda turno; `Screens.partida`
lo va llamando con una pausa (`RITMO_IA`) para que se vea el indicador pasar
por P·A·C·F. `AI.jugarTurno()` sigue existiendo y no es más que ese mismo
método en bucle: es lo que usa el banco de simulación, que no quiere pausas.
Si tocas la lógica de la IA, tócala en `jugarFase` y las dos vías se enteran.

Ojo con el cerrojo `iaEnCurso`: se suelta **antes** del `pintar()` final de la
cadena. Si se soltara después, ese repintado vería la IA todavía en curso y
no arrancaría el turno siguiente.

**El indicador de fase se genera desde `Game.FASES`.** Los cuatro puntos
(P·A·C·F) de la franja central salen del propio orden del motor, así que no
puede desincronizarse: si algún día cambian las fases, basta con añadir la
letra en `INICIAL_FASE` y el nombre en `NOMBRE_FASE`. Ojo, son tres tablas
distintas y a propósito: `ETIQUETA_FASE` es el rótulo de la cabecera
(«Ataque») y `NOMBRE_FASE` el del punto («Combate»), porque la letra C no
casa con la palabra ataque.

**El retrato va DELANTE del panel, y lo que salva la legibilidad es su
opacidad.** `.mesa-flotantes` está en z-index 7, por encima de las cartas y
de los marcadores de sangre; el personaje se lee como una presencia sobre la
mesa en vez de como una figura recortada por detrás. Que eso no esconda la
vida ni las estadísticas depende **solo** de `opacity: 0.65` en
`.flotante img`. Si subes esa opacidad, tendrás que devolver el panel por
delante o los números se pierden.

Dos trampas aquí:

- **La opacidad va en la imagen, no en `.flotante`.** La animación de entrada
  acaba en `opacity: 1` y, con `animation-fill-mode: both`, pisa cualquier
  opacidad puesta en el elemento animado.
- **Ir por delante no basta para el texto tenue.** Con arte debajo hace falta
  además una sombra que lo despegue; de ahí la de `.sangre-pie`.

**El arte flotante es opcional y va por `imagenFlotante`.** Es una ruta
completa desde `src/` (no el nombre suelto, como sí lo es `imagen`), vive en
`src/assets/personajes-flotantes/` y la tienen los 24 personajes de las cuatro
estirpes más los 4 eternals. Los únicos sin retrato son los 6 mercenarios, que
simplemente no flotan. Al añadir personajes, recuerda
que `tools/generar-datos.js` enumera los campos uno a uno: un campo nuevo en
el `-source.json` que no esté en `lineaPersonaje()` se pierde al regenerar.

**La partida guardada cuelga del nombre de la app.** Electron deriva
`userData` de `package.json`, así que hoy vive en `%APPDATA%\aeternum\
savegame.json`. Al renombrar el proyecto de «Crónica de Eones» a AETERNUM la
carpeta cambió y el progreso anterior quedó atrás, sin migrar y a propósito,
en `%APPDATA%\cronica-de-eones\`. Si alguna vez hay que rescatarlo, ahí está.
Tenlo presente antes de volver a tocar `name` o `productName`.

**Lo que no esté bajo `src/` no entra en el `.exe`.** El `files` de
electron-builder empaqueta `src/**/*`, así que un recurso suelto en la raíz
del repo (como `Visuals/`) funciona con `npm start` y falta en el instalador.
Los recursos van copiados a `src/assets/`.

Y ojo, que `files` es una **lista blanca**, no un patrón general:
`["main.js", "preload.js", "src/**/*", "package.json"]`. Un módulo nuevo en la
raíz —por ejemplo para sacar una función de `main.js`— funcionaría con
`npm start` y **reventaría el `.exe`** con un `require` de algo que no está.
O se añade a `files`, o se queda dentro de `main.js`.

**Los enlaces a la web salen por `shell.openExternal`, nunca dentro de la app.**
Una página cargada en la propia ventana se queda con el marco del juego. Con
`contextIsolation: true` el renderer no puede llamar a `shell`, así que va por
IPC: `arena:abrir` en `main.js` y `abrirArena()` en el puente.

**La dirección vive en `main.js`, no en la pantalla que pulsa el botón.** El
canal no acepta parámetros a propósito: abre un único sitio conocido y no
cualquier URL que le pasen, así que no hace falta validar nada ni mantener una
lista blanca de dominios. Si algún día hay un segundo enlace, lo suyo es otro
canal con su destino fijo, no un `abrirUrl(url)` genérico.

Detalle que muerde al probar esto: **el objeto de `contextBridge` es inmutable
en el renderer**. Sustituir `window.gameAPI.abrirArena` por un doble no falla,
simplemente no hace nada y se sigue llamando al real. Para provocar el camino
de error hay que hacerlo fallar desde el proceso principal.

**Las cinemáticas no llevan duración escrita: se calcula del texto.** Todas van
al mismo ritmo de lectura, `Cinematica.CARACTERES_POR_SEGUNDO` (20 car/s, con un
suelo de 2,5 s), así que en `dungeons.js` solo se escribe `{ texto }`. Editar
una frase reajusta su tiempo sola. `mostrar()` acepta un `segundos` explícito
como excepción, pero hoy no lo usa nadie y conviene que siga así.

Vino de un problema real: con los tiempos a mano convivían textos a 20 car/s y a
39, y los de 39 no se podían leer. Y **el «clic para continuar» no compensa eso,
porque ACORTA**: llama a `salir(SALIDA_RAPIDA)` y se lleva la cinemática en 260
ms. Medido, un texto de 117 caracteres pasa de 5,5 s en pantalla a 1,5 s si lo
pulsas. Es un botón de saltar, no de avanzar, así que el ritmo es todo el tiempo
de lectura que tiene quien no toca nada.

**No llames a `video.play()` justo después de pintar el HTML.** La promesa se
aborta porque el `<source>` todavía no está resuelto y, de paso, apaga la
bandera de autoplay del elemento: el vídeo se queda pausado para siempre y no
hay ningún error en consola que lo delate. Deja que arranque el atributo
`autoplay` y, si acaso, insiste desde el evento `canplay`. Ver
`Screens.mainMenu`.

**La cinemática es la única cosa de `core/` que toca el DOM, y lo hace sobre
`document.body` a propósito.** Si pintara dentro de `#app`, el
`contenedor.innerHTML = ''` del Router se la llevaría a mitad del fundido. Dos
consecuencias que conviene tener presentes:

- **Quien la lanza espera su promesa y luego navega**, nunca al revés. Ese es
  el motivo de que el manejador de «Entrar» de `Screens.historia` sea `async`.
  La de victoria va antes del cartel de fin: `pintarFin()` se lanza a sí mismo
  de vuelta al resolverse, y por eso lleva la bandera `cineFinLanzada` —sin
  ella, cada `pintar()` posterior relanzaría la escena.
- **`Router.ir()` llama a `Cinematica.cortar()`.** En el camino normal no hace
  nada, porque la capa ya se retiró antes de navegar. Está para que un cambio
  de pantalla inesperado no deje un rectángulo negro encima del juego sin nada
  debajo que lo explique.

**Las duraciones de la cinemática se declaran en el JS, no en el CSS.** Los
`setTimeout` que retiran la capa y las transiciones que la funden tienen que
durar lo mismo; con los números escritos en los dos sitios se desincronizan a la
primera. `cinematica.js` empuja sus constantes a la hoja como custom properties
(`--cine-entrada`, `--cine-aparicion`, `--cine-salida`).

**El dorado del texto es un degradado recortado, así que la sombra va en
`filter`.** Con `-webkit-text-fill-color: transparent`, un `text-shadow` en el
mismo elemento se vería a través de las propias letras. De ahí el
`drop-shadow()`. El `color` plano de reserva se declara antes del degradado por
si el recorte no llega a aplicarse.

**Cuidado al quitar campos de `Game.RACES`.** Al eliminar `pasiva` y
`estadisticasBase` quedaron dos pantallas leyéndolos, y ambas reventaban.
Si tocas ese objeto, busca los consumidores antes:
`grep -rn "\.pasiva\|estadisticasBase" src/js/`

**Confirmación genérica para lo irreversible: `ui/confirmar.js`.** Antes de
esto no había ningún diálogo propio del juego para pedir «¿seguro?» — la única
opción habría sido `window.confirm()`, que rompe con la estética (fuente del
sistema, sin la paleta del juego). `Game.Confirmar.preguntar({titulo, texto,
textoOk})` devuelve una promesa; `true` si confirma. El foco por defecto va en
**Cancelar**, no en el botón de acción, a propósito: para algo destructivo,
que una tecla Intro perdida no dispare nada. Escape y el clic fuera de la caja
también cancelan. Es la misma familia que el mezclador: capa suelta colgada de
`body`, no una pantalla del Router.

Hoy la usan dos sitios: «Reiniciar aventura» en el menú y **«Abandonar» en la
partida**, que antes se iba al menú de un clic y sin preguntar, tirando el
duelo en curso. Ahí el diálogo **solo sale si el duelo NO ha terminado**: con
la partida ya resuelta el botón es la puerta de salida y preguntar sería ruido.
Y el texto nombra la etapa concreta y aclara el alcance real —se pierde ESA
etapa, no el avance de las anteriores—, porque «¿seguro?» a secas no dice
cuánto se pierde.

**«Reiniciar aventura» (`State.reiniciarAventura()`) tiene un alcance
deliberadamente parcial.** Vuelve a cero el modo historia —`progresoHistoria`,
`gemas`, `historiaFinalVista`, `recompensaFinalAnunciada`, `razaSeleccionada`,
y el tutorial (`tutorialVisto`/`tutorialSaltado`, para que se repita: es parte
de empezar de verdad desde el principio)—, y con eso el modo solo, el
constructor y los mercenarios se recierran solos, porque `desbloqueado()` ya
depende de esos campos. Pero **NO toca** `volumenes` (preferencia de sonido,
no progreso de campaña), `equiposGuardados` (son creaciones del jugador, no
avance) ni `partidasJugadas` (estadística acumulada). El botón del menú solo
se pinta cuando `hayAventuraQueReiniciar()` es cierto, para no ofrecérselo a
un perfil que no tiene nada que perder.

**Estética común (la «base») y menú nuevo.**

- **Tokens** en `:root`: `--fuente-titulo` (serif; va a fuentes del sistema
  —Palatino Linotype / Book Antiqua vienen en Windows— para que el .exe no
  dependa de internet; Cinzel encabeza la lista por si algún día se incluye en
  assets) y los oros `--oro-claro/medio/hondo`.
- **Títulos de pantalla** (`.pantalla-titulo`) en esa letra con degradado
  dorado; con `.tinte` manda el color de la estirpe. Botones dorados con brillo
  de metal (`.btn-primario`).
- **Esquinas doradas** en `::after` de `.raza-tarjeta`, `.raza-detalle`,
  `.etapa`, `.capitulo` y `.solo-tarjeta` (ninguno usaba ya pseudo-elementos;
  si uno nuevo los necesita, sacarlo de esa lista).
- **Transición entre pantallas**: el `.fade-in` del Router es ahora fundido
  con un leve acercamiento y desenfoque (360 ms). Acaba en `transform: none`,
  así que no deja un contenedor transformado (que rompería los `fixed`).
- **Menú**: logo AETERNUM dorado con un brillo que lo cruza cada 7 s; los
  modos como CARTAS en abanico con arte (Historia: Annia sobre el bosque;
  Solo: Üldar; Crea tu equipo: tres cartas reales; Online: el reverso oficial,
  que es el de jugar contra personas). Las cerradas, apagadas con cadenas en X
  y candado. Vídeo a pantalla completa, luciérnagas en un `<canvas>` y
  profundidad con el ratón (`--px/--py`); todo se suelta en `destruir()`
  (`pararAmbiente`) y se apaga con `prefers-reduced-motion`. El pie lleva
  iconos redondos (sonido, reiniciar, salir) con los mismos ids de antes.

**El calabozo: mapa protagonista y placa de etapa** (`Screens.historia`).
Ya no hay lista de etapas: tres columnas —el mapa a toda la altura (el SVG
lleva `aspect-ratio` en línea con las medidas de su arte; sin eso la columna
`auto` y el mapa se esperaban y salía diminuto), la placa de la etapa elegida
y la lupa—. Los nodos son medallones (radios en CSS, `r` es propiedad CSS en
SVG) y pulsar uno la enseña en la placa (`elegirEtapa` → `pintarFicha`), con
flechas ‹ › para la anterior y la siguiente. La placa trae número, título,
narración, la oleada y la recompensa en abanico (velada si la etapa está
cerrada) y un «Entrar»/«Repetir» grande (`entrar(n)`: cinemática, travesía y
partida, igual que antes). La lupa arranca con la primera criatura. Se fue el
botón «Avanzar →» del lateral: lo hace el «Entrar» de la etapa que toca, que
es la elegida al abrir.

**Estirpes: cartas altas y vitrina de gemas** (`Screens.seleccionRaza`).
Cada estirpe es una carta con su tapete de fondo y el busto del líder (el
primero con retrato de `personajesIniciales`); la elegida se levanta y brilla
con su color; las cerradas, con el líder en SILUETA (`brightness(0)`) y
candado. Los cristales son piedras talladas (`clip-path` octaedro) que laten
con el color de su estirpe; las que faltan, huecos oscuros con «?». La vitrina
va AL LADO de la ficha (`.raza-bajo`, rejilla de dos columnas), no encima: esta
pantalla no se desplaza. Al estrecharse, la ficha se pasaba 94-131 px; se
compactó (datos en dos columnas, sin la frase bajo la curva, cartas a 26vh) y
medido queda en 0 de desborde, ficha y vitrina, en 1024×700, 1194×728 y
1280×800. Si se añade algo fijo aquí, medir la ficha (`#raza-detalle`).

## Estado actual

Jugable: menú, selección de raza, constructor de equipos, duelo contra la IA
y **los cuatro calabozos** (6 etapas cada uno, con narración y desbloqueos):
Bosque Nocturno, Catacumbas, Forjas y Oasis.

El **Bosque Nocturno lleva cinemáticas**: fundido a negro y texto dorado al
entrar al calabozo, al empezar cada etapa y al ganarla. Todas saltables con un
clic o cualquier tecla. Los otros tres calabozos aún no tienen textos escritos,
y sin ellos simplemente no se dispara ninguna escena.

Y una **escena de vídeo** antes del texto: `DUNGEONS[x].videoIntro`, que lanza
`Cinematica.videoUnaVez()`. Se encadenan con `await` en
`Screens.historia.escenaDeEntrada()`, nunca a la vez: `Cinematica` sostiene
**una sola capa**, así que lanzar los dos en paralelo haría que el texto cortara
el vídeo al montarse. Cada uno lleva su propia clave de «visto», de modo que
saltar el vídeo no se salta el texto.

La forma es `{ src, conSonido }`. **El sonido se decide midiendo el archivo, no
a ojo:** el intro del Bosque trae su pista en silencio digital (-91 dB de media
y de máximo) y va mudo, porque silenciarlo no cuesta nada y así la política de
autoarranque no puede bloquearlo; el del Oasis tiene audio real (-20 dB de
media, picos a -1,3) y suena. Comprobar con
`ffmpeg -i x.mp4 -af volumedetect -f null -` antes de decidir.

**La música del calabozo NO se aparta durante la escena**: las dos suenan a la
vez, por decisión de Oscar. El volumen del vídeo sí sigue al mando de música del
mezclador, para que quien lo tenga a cero no se lleve un susto. Y si Chromium
niega el autoarranque con sonido, se reintenta en silencio antes de rendirse:
mejor la escena muda que un negro.

Dos cosas más del reproductor que se pagaron caras:
- **El `error` de un `<source>` NO salta en el `<video>`.** Con el archivo
  ausente, la promesa tardaba **20 s** en rendirse por el temporizador de
  seguridad en vez de reaccionar al momento; escuchando el `<source>` baja a
  ~5 ms. Y el tope total se calcula sobre la duración real tras
  `loadedmetadata`, no fijo: un número fijo cortaría una escena más larga.
- **`max-width: 100%` no escala, solo limita.** El vídeo se quedaba a su tamaño
  intrínseco (854×480 en una ventana de 1280×816, el 67% del ancho) con un marco
  negro enorme. Con `width/height: 100%` y `object-fit: contain` sí llena.

El tutorial (`core/tutorial.js`) tiene **dos clases de paso** y la diferencia
importa. Para probarlo de nuevo desde cero: `Game.Tutorial.reiniciar()` en la
consola.

**El recorrido (`tour: true`): la etapa 1 del Bosque es la clase de manejo.**
Dieciséis burbujas en orden antes de la primera rata, cada una anclada a su
elemento real: mesa, los dos lados, las tres pilas de sangre, la energía, reserva
y Hades, las fases, los controles, avanzar de fase, la lupa, los tres paneles
laterales, el sonido y la salida. Llevan cuenta («7 de 16») porque dieciséis
seguidas sin saber cuántas faltan se sienten interminables. Solo se dan donde
dice `RECORRIDO_EN` —`desterrado` etapa 1—: ofrecerlas en cualquier etapa las
repartiría sueltas por calabozos donde ya no enseñan nada.

Un paso puede traer `antes(contenedor)` para preparar la pantalla antes de
anclarse. Lo necesitan los tres del lateral: su panel está `oculto` y, aunque
`querySelector` lo encuentre, **mide 0×0 y la burbuja acabaría en una esquina**.
`antes` pulsa su pestaña primero. Si añades un paso a una zona escondida,
necesita su `antes`.

**Los contextuales** salen cuando esa zona importa de verdad, en cualquier etapa.
Los que explican TUS controles llevan `esMiTurno(m)`: sin él se colaban en el
turno del rival —la fase de ataque de la IA cumple «estás en fase de ataque»
exactamente igual—, y el tutorial paraba la cadena de la IA para explicarte un
botón que en ese momento no era tuyo. La excepción es `defensa`, que existe
precisamente para el ataque declarado por la IA, y va **antes** de `combate` en
la lista: cuando el golpe es del rival, lo primero es saber que puedes responder,
no cómo se calcula.

El lateral del modo historia lleva un **mapa de avance**: un sendero SVG con
un nodo por etapa, generado en `Screens.historia.mapaDeAvance()` a partir de
`cal.etapas` y del progreso guardado. Pulsar un nodo lleva a la ficha de esa
etapa; entrar a jugar sigue siendo cosa del botón de la ficha.

**Los cuatro calabozos ya tienen arte de mapa propio** —`assets/mapas/<raza>.jpg`,
mapas de batalla con rejilla, uno por calabozo—, declarado en
`DUNGEONS[x].mapa: { imagen, ancho, alto, nodos }`. `nodos` son 6 coordenadas
**en píxeles de la imagen**, una por etapa, plantadas A MANO sobre el camino que
ya dibuja el propio arte: el hueco iluminado entre las raíces del Bosque, la
nave de la catedral bajando hacia la cripta en Catacumbas, el cañón entre
cristales del Oasis, los puntos de interés de la Forja. No se infieren solas —si
se añade un mapa nuevo, las coordenadas se sacan mirando la imagen con una
rejilla superpuesta (`PIL.ImageDraw`, líneas cada 40px con las cifras escritas),
nunca a ojo sobre el arte sin más.

`mapaDeAvance()` cae al sendero genérico —el zigzag `IZQ`/`DER` de siempre, sin
imagen— cuando el calabozo no trae `mapa` o su `nodos.length` no cuadra con el
número de etapas. Es la red para un calabozo futuro sin arte todavía; no borres
esa rama pensando que ya sobra.

**Y el personaje RECORRE ese mapa (`ui/travesia.js`).** Al pulsar «Avanzar»
(bajo el mapa) o «Entrar»/«Repetir» en una ficha: primero el texto de entrada de
la etapa, luego el mapa se abre en grande y el retrato flotante del primer
personaje del equipo camina por el tramo de sendero hasta el nodo de la etapa
(rebota a cada paso, se balancea y mira hacia donde va); al llegar le salen al
paso las criaturas —con su retrato flotante si lo tienen (los Eternals), si no
su carta— y el duelo empieza directo. Un clic o una tecla lo saltan. Fuera de
la travesía, el personaje queda de pie en el mapa del lateral, en la última
etapa superada («estás aquí»). Detalles que importan:

- `geometria()` y `tramo()` de `Screens.historia` son la ÚNICA fuente del
  sendero: el mapa del lateral y la travesía dibujan y recorren la misma curva.
- Antes de la etapa 1 se sale de `puntoDePartida()`, un punto que prolonga
  hacia atrás el primer tramo.
- El jefe suele estar en el borde superior del mapa: la figura nunca sube por
  encima de su propia altura y los enemigos se ponen en fila FRENTE al
  personaje, del lado del mapa con más sitio. Sin eso salían cortados.
- Es una capa de `body`, como la cinemática: se espera su promesa y DESPUÉS se
  navega. `viajando` impide lanzar dos travesías con un doble clic.

**Escenario 2D (`ui/escenario2d.js` + `ui/temas2d.js`): el calabozo de LADO.**
Si el calabozo trae `escenario2d: '<tema>'` en `data/dungeons.js`, la travesía
no es sobre el mapa sino una escena horizontal: el personaje avanza de la etapa
anterior a la siguiente (la etapa k está en x = k·PASO), la cámara lo sigue, le
salen al paso los enemigos junto al poste de la etapa y empieza el duelo. El mapa
del calabozo queda como minimapa en una esquina, con un punto que avanza. Hoy
lo tienen el Bosque (`bosque`) y el Oasis (`oasis`: agujas de roca, árboles de
copa redonda y cristales; el hito es una estela con un orbe en vez de farol); los
demás usan la travesía sobre el mapa hasta que tengan su tema.

- **Las capas están PINTADAS con Python** (`tools/fondos2d/`, numpy + PIL, el
  mismo enfoque que los fondos de Dracoslayer pero en alta resolución y con
  acabado pictórico): `python tools/fondos2d/bosque.py [capa ...]` deja tiras
  WebP en `src/assets/escenario2d/<tema>/` (~700 KB el bosque entero). Cada tira
  se repite en horizontal SIN COSTURA: lo que se pinta junto a un borde se pinta
  también al otro lado (`Tira.pegar` envuelve) y el ruido que la cruza es
  periódico. `pintura.py` trae las herramientas comunes: troncos con volumen
  (forma analítica + luz lateral + vetas + musgo), ramas, follaje, halos.
- **La paleta se MIDE del fondo pintado de la estirpe, no se inventa.** La
  primera versión usó una bruma turquesa supuesta (`#7fb498`) y salieron postes
  blancos y musgo de camuflaje; medida (mediana de zonas de `desterrado.jpg`),
  la bruma es `#487750`, los troncos `#0f1306` y el suelo `#162712`, y con eso
  las capas se funden con el fondo. Para un tema nuevo: medir primero.
- **Lo que se anima va en vivo** (motor de «sellos» en `temas2d.js`): haces de
  luz, niebla, luciérnagas, la luz del farol y el número de la etapa sobre el
  poste pintado. El orden de todo lo dicta `tema.orden` (tipos `fondo`, `tira`,
  `capa`, `niebla`, `hitos`, `actores`, `particulas`, `velo`).
- **Profundidad**: lo lejano más claro, desenfocado y semitransparente (deja ver
  el fondo pintado de la estirpe, que es la capa más lejana); lo cercano casi
  negro y con luz lateral (`iluminar`, `source-atop`); el primer plano fuera de
  foco. Entre capas, bandas de niebla.
- **Los retratos flotantes son BUSTOS**, no cuerpos enteros: el personaje avanza
  flotando con la base fundida (`fundirBase`) y una niebla baja pintada DELANTE
  de los actores, para que no se vea el corte recto. `voltearFigura` del tema
  es por si el retrato mira hacia atrás; el de Annia ya mira a la derecha.
- Las cosas grandes del primer plano tapaban a la protagonista: las frondas solo
  asoman por abajo (`base` > 1).
- **Conversación al andar**: una etapa puede traer `dialogo: [{ quien, texto }]`
  en `data/dungeons.js`. El líder (primer personaje con retrato) camina con un
  acompañante —el primero que habla en el diálogo y está en el equipo— y cada
  frase sale en un bocadillo sobre quien la dice, escribiéndose letra a letra.
  Con diálogo, la marcha dura lo que la conversación (cada frase, lo que tarda
  en leerse a 20 car/s, como las cinemáticas): llegan al terminar de hablar y
  ENTONCES salen los enemigos. Clic = frase siguiente (los personajes aceleran
  para no quedarse atrás: la posición persigue a un reloj «virtual» que el clic
  adelanta, así nadie se teletransporta); Esc = saltar todo.
  Los diálogos del Bosque y del Oasis son BORRADORES de Claude a partir de la
  narración de cada etapa, marcados así en los datos: los textos son de Oscar.
- **El bocadillo**: se mide ya escrito y se recoloca dentro del marco, con el
  piquito desplazado (`--cola`) para seguir apuntando a quien habla. Ojo: el
  `display: flex` de `.esc2d-globo` anulaba el atributo `hidden` —el CSS de
  autor gana al del navegador— y el bocadillo se quedaba encima del encuentro;
  por eso existe `.esc2d-globo[hidden] { display: none }`.
- **Hacia dónde miran**: todos avanzan a la derecha; los retratos que miran a la
  izquierda se listan en `Escenario2D.MIRAN_A_LA_IZQUIERDA` y se voltean.
  Comprobar a ojo con una hoja de contacto al sumar personajes que caminen.

Ojo con tres cosas si tocas esto:

- **La campaña es lineal**, y probar el mapa de una raza tardía exige haber
  completado las anteriores en el perfil (`progresoHistoria`), o el Router
  redirige a `seleccionRaza` sin más aviso que un mensaje en consola. Ya lo
  documenta la nota de `State.desbloqueado()`, y es fácil volver a caer en
  ello probando esto en concreto porque cada calabozo tiene SU PROPIO progreso
  y es tentador dárselo suelto. (Ocurrió verificando el punto siguiente: un
  perfil con las cuatro razas al 50% —en vez de las tres primeras completas—
  bloqueó tres de los cuatro calabozos y disfrazó de «excepción en el DOM» lo
  que era en realidad un `Router.ir()` que nunca llegó a navegar.)
- **El rótulo «JEFE» ya no asume `x === IZQ`**: con coordenadas de arte
  arbitrarias, huye del borde según a qué mitad del ANCHO REAL de la imagen
  cayó el nodo (`x < ancho / 2`), no de una constante fija de dos columnas.
- **La lupa del lateral ya NO lleva `position: sticky`.** La llevó mientras el
  mapa era el sendero SVG genérico (pequeño, sin imagen): con eso, el mapa de
  arte real —hasta 450+ px de alto sin tope— comprimía la lupa contra su
  `min-height: 165px` Y ADEMÁS la dejaba clavada TAPANDO la cola del mapa (35 px
  de solape medidos). El arreglo tiene dos partes que van juntas: `max-height:
  42vh` en `.mapa-calabozo svg` (se reescala completo, no se recorta, porque el
  navegador respeta el aspect ratio del `viewBox`) y quitar el `sticky` de
  `.calabozo-lateral .lupa`, que vuelve a fluir en orden normal. Si algún día el
  mapa necesita crecer, el sitio para tocar es ese `max-height`, no reintroducir
  el `sticky`.

Pendiente:

- La IA sigue siendo una heurística básica para DECIDIR, aunque ya aplica
  todas las cartas (tandas 1-5) y valora con pasivos (tanda 6).
- **El calabozo es ahora más duro, y está medido.** Con los efectos aplicados,
  los duelos contra oleada acaban en **6,6 turnos de media en vez de 8,1** (144
  duelos, las 6 etapas de los 4 calabozos): la oleada mata antes. En modo solo,
  17,1 → 12,4. No se ha reajustado ninguna oleada a cambio; si alguna etapa se
  vuelve injusta, ese es el sitio, no la tabla de efectos.
- Rompescudos no llega a equiparse en ninguno de los mazos actuales (0 veces en
  272 duelos), así que su negación solo está probada en unidad, no en juego.
- **Los Reanimados son la estirpe floja** (ver tanda 6): es poder de carta,
  no IA. Decisión de Oscar pendiente.

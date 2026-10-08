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

## Trampas ya pisadas

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

- La IA sigue siendo una heurística básica para DECIDIR, aunque ya aplique los
  efectos de 8 de sus 12 cartas de acción y los jefes sus 16 habilidades.
  Quedan 4 en `SIN_AUTOMATIZAR`, cada una con su motivo escrito.
- **El calabozo es ahora más duro, y está medido.** Con los efectos aplicados,
  los duelos contra oleada acaban en **6,6 turnos de media en vez de 8,1** (144
  duelos, las 6 etapas de los 4 calabozos): la oleada mata antes. En modo solo,
  17,1 → 12,4. No se ha reajustado ninguna oleada a cambio; si alguna etapa se
  vuelve injusta, ese es el sitio, no la tabla de efectos.
- Rompescudos no llega a equiparse en ninguno de los mazos actuales (0 veces en
  272 duelos), así que su negación solo está probada en unidad, no en juego.
- Sin pruebas automatizadas persistentes: las comprobaciones de `accionesIA` y
  el experimento con/sin viven en el scratchpad de la sesión, no en el repo.

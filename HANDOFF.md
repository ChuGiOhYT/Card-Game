# HANDOFF — AETERNUM

Punto de retoma para quien (persona o IA) continúe este proyecto. Escrito el
9 de agosto de 2026, tras cerrar los 4 calabozos del modo historia.

**Antes de tocar nada, lee [CLAUDE.md](CLAUDE.md).** Ese archivo tiene las
convenciones, las reglas del motor y las trampas de entorno ya pisadas
(caché del panel de vista previa, heredocs de bash, Electron colgados). Este
documento es el estado y el plan; CLAUDE.md es el manual de operación.

Para encontrar una función concreta, **[MAPA.md](MAPA.md)** es el índice
generado (`npm run mapa` lo regenera) con archivo y línea de cada símbolo.

## Qué es esto

Juego de cartas por turnos en Electron, sin dependencias en tiempo de
ejecución (HTML/CSS/JS plano). Cuatro razas jugables — Desterrado, Lunaria,
Oxitrón, Reanimado — cada una con su calabozo de 6 etapas en modo historia,
más un modo solo (duelo suelto contra la IA) y un constructor de equipos.

Las 45 cartas jugables y las 21 criaturas de calabozo son transcripciones
literales de un juego de mesa físico real (`Aeternum TCG` en el escritorio
del usuario). No hay nada inventado en los valores de las cartas; lo que sí
es invención de esta implementación son los nombres/narración de las etapas
de calabozo y las decisiones de mapeo criatura↔raza (documentadas más abajo).

## Cómo arrancar

```bash
npm install         # una vez
npm start            # jugar
npm run dev           # con DevTools abiertas
npm run dist          # compilar dist/AETERNUM-Setup-*.exe y -portable-*.exe
```

El `.exe` en `dist/` **no se actualiza solo** — hay que recompilar tras cada
cambio si se va a probar el instalador.

## Estado: qué funciona hoy

- **Menú, selección de raza, constructor de equipos, duelo contra IA.**
- **Los 4 calabozos completos**, 6 etapas cada uno, con narración propia y
  desbloqueo de personaje+acción por etapa superada:
  - Desterrado → *El Bosque Nocturno* (jefe: Üldar)
  - Lunaria → *El Oasis* (jefe: Brahma)
  - Oxitrón → *Las Forjas* (jefe: A'tar)
  - Reanimado → *Las Catacumbas* (jefe: Tarh Akh)
- **Campaña lineal**: el orden lo fija `Game.RACE_ORDER` en
  `src/js/data/races.js` — actualmente
  `['desterrado', 'lunaria', 'oxitron', 'reanimado']`. Cada calabozo se
  abre solo al **terminar** (las 6 etapas, jefe incluido) el anterior. Una
  estirpe bloqueada se puede mirar (ficha, curva de coste) pero no elegir.
- **Modo solo y constructor bloqueados** hasta terminar un calabozo entero
  (`State.CALABOZOS_PARA_DESBLOQUEAR`, hoy en 1). El cerrojo vive en
  `Router.CERRADAS`, no solo en el menú — no hay ruta directa que lo salte.
- **Un solo personaje en posición a la vez, siempre**, tanto en duelo como
  en calabozo (`maxActivos: 1` para el jugador). Solo el lado enemigo del
  calabozo sube ese límite, para desplegar su oleada de varias criaturas
  simultáneas. *(Esto se corrigió recientemente — ver "Errores ya
  cometidos" más abajo, fue un malentendido mío que llegó a producción.)*
- **Combate en dos pasos**: declarar ataque → aplicar efectos manuales →
  resolver. No se puede cambiar de fase con un ataque a medias.
- **Panel de Herramientas** (`core/manual.js`): el jugador aplica a mano los
  efectos impresos de las cartas (dado, modificar ataque/defensa, sangre,
  Hades, revelar/ocultar, bloquear). El motor no ejecuta ningún efecto de
  carta por sí solo — decisión de diseño explícita para no programar 33
  mecánicas distintas.
- **Tutorial por burbujas** (`core/tutorial.js`): pasos anclados a zonas
  reales de la pantalla, se disparan por condición de estado (`m.fase`,
  `m.numeroTurno`, etc.), solo en modo historia, una vez por perfil.
  `Game.Tutorial.reiniciar()` en consola para verlo de nuevo.
- **Sangre en tres pilas** (pila/gasto/fuera, suma 30 siempre), **Hades como
  zona abierta**, **dos condiciones de victoria** (sangre a 0, o sin
  personajes en pie).

## Pendiente / conocido y no resuelto

1. **El balance de las etapas 6 no está medido.** Desde el 11 de agosto de
   2026 los jefes ejecutan sus habilidades solos (`core/bossAbilities.js`,
   una al azar por turno suyo), y eso cambia por completo la dificultad del
   combate final. El golpe «al grupo» ronda los 10 puntos: si llegas en
   neutral, se los come tu sangre; si vas en defensiva con defensa
   suficiente, falla. Nadie ha jugado las cuatro etapas finales de principio
   a fin con esto puesto.
2. **La IA sigue sin usar el panel de Herramientas.** Nunca tira dados ni
   aplica los efectos impresos de sus cartas normales (las habilidades de
   jefe sí se ejecutan). Elige la acción simulando el intercambio con las
   reglas reales, medido a 54-55% contra la heurística anterior, pero eso
   solo cubre *qué acción acopla*: a quién despliega y a quién ataca siguen
   siendo reglas fijas.
3. **Los duelos ya casi no acaban por eliminación.** Con la IA nueva, de
   4800 duelos simulados 4791 terminaron por sangre y solo 9 por quedarse sin
   personajes; con la heurística anterior era al revés. La IA penaliza morir,
   así que ambos bandos se cubren y el duelo se vuelve una carrera de
   desgaste. Gana más partidas, pero cambia el ritmo del juego. Si se quiere
   recuperar el intercambio de golpes, la palanca es `pesoMorir` en
   `AI.AJUSTES` — ojo, bajarlo no mejoró el porcentaje de victorias.
4. **Reanimado está roto de equilibrio.** Gana un 5-8% contra Desterrado y
   Lunaria en simulación. Su motor es el Hades, y la IA no ejecuta efectos
   impresos, así que la raza juega sin su mecánica. No es culpa de la IA:
   un jugador humano sí puede usarla.
5. **El balance sigue sin medirse con efectos aplicados.** El banco
   (`npm run simular`) juega sin que nadie use Herramientas, así que los
   números de arriba describen un juego sin efectos de carta. Con un humano
   aplicándolos, el reparto puede ser muy distinto.
6. **Dos erratas de las cartas originales, transcritas literalmente y
   marcadas con `_aviso*` en `creatures.js`:**
   - "Los contenados" (probable errata de "condenados") en el calabozo de
     Lunaria.
   - El texto de "Convocar" de Üldar y de A'tar menciona "esbirro del
     oasis" copiado de Brahma; el esbirro real que deben convocar es el de
     su propio calabozo. Ya está corregido en el campo `criaturas`, el
     aviso es solo sobre el texto impreso.
7. **El mapeo criatura↔calabozo↔raza ya está confirmado por el usuario**
   (11 de agosto de 2026), y no es el que dedujo la sesión original. Las
   Catacumbas son de los **Reanimados** y El Oasis es de **Lunaria**, al
   revés de como estaban. El usuario lo detectó por los fondos de ambiente:
   la necrópolis pega con los muertos y la luna con Lunaria. Al intercambiar
   los calabozos se movió el escenario (nombre, intro, eternal, criaturas,
   títulos y narración) pero **no** las recompensas ni el personaje inicial,
   que pertenecen a la raza. Hubo que reescribir a mano los pasajes que
   nombraban a Sadash o a Luh, y los que aludían al nigromante o al culto
   del eclipse. Si se vuelve a tocar, revisa esas menciones cruzadas.
8. **Sin suite de pruebas de invariantes.** Ya hay un banco de simulación
   versionado (`tools/simular.js`, `npm run simular`), pero mide equilibrio y
   fuerza de la IA, no corrección. Las invariantes del motor —suma de sangre
   = 30, un solo activo del jugador, condiciones de victoria, cerrojo de
   campaña lineal— se siguen comprobando con scripts desechables que no
   quedan en el repo.

## Decisiones de diseño que no son obvias leyendo el código

- **La energía es un umbral, no un recurso que se gasta.** Derramar sangre
  (perder vida) es lo que da energía; desplegar un personaje de coste N
  solo exige tener ≥N en la pila de "gasto", no la consume. Solo las
  cartas que dicen explícitamente "paga" mueven sangre a la pila "fuera"
  (permanente). Este fue un contrasentido inicial del proyecto que se
  corrigió pronto — vale la pena releer `core/turnEngine.js` antes de tocar
  cualquier cosa relacionada con sangre.
- **Las acciones (ofensiva/defensiva/neutral) no suman números.** Solo
  activan qué estadística cuenta. Todo bonus numérico entra por
  `inst.modificadores`, aplicado manualmente vía Herramientas.
- **El equipo crece en calabozo, la posición no.** Ver punto de "un solo
  personaje en posición" arriba — este fue el error más reciente y más caro
  en tiempo: la primera implementación permitía varios activos a la vez
  conforme el equipo crecía, y era la lectura equivocada de lo que el
  usuario pidió.

## Errores ya cometidos (para no repetirlos)

- **Confundí "equipo que crece" con "personajes activos simultáneos".**
  El usuario pidió una banda que se refuerza con cada etapa superada; lo
  implementé dejando que varios personajes ocuparan la posición a la vez
  (`maxActivos` subiendo con el progreso). Eso rompía la regla base del
  juego (un activo por turno) y el usuario lo detectó jugando. Se corrigió
  volviendo `maxActivos: 1` fijo para el jugador en todo contexto; el
  equipo sigue creciendo (más personajes disponibles en reserva) pero solo
  uno pisa el campo. **Lección: cuando una regla base del sistema (un solo
  activo) parece entrar en tensión con una petición nueva, confirmar antes
  de reinterpretar la regla base — no asumir que la petición la reemplaza.**
- **Al eliminar campos de `Game.RACES` (`pasiva`, `estadisticasBase`)
  quedaron pantallas leyéndolos sin comprobar.** Ambas reventaban al
  cargar. Antes de quitar un campo de un objeto de datos ampliamente
  consumido, `grep -rn` el nombre del campo en `src/js/` primero.
- **El panel de vista previa del entorno sirve JavaScript cacheado.** Un
  cambio guardado en disco puede no reflejarse ahí. La verificación fiable
  de cambios de JS en este proyecto es lanzar Electron directamente con un
  script de prueba (ver ejemplos de sesión, no versionados) — no confiar en
  el navegador embebido del panel para confirmar que un fix funcionó.
- **Heredocs de bash rompen rutas de Windows con contrabarras.** Usar la
  herramienta de escritura de archivos para scripts de prueba de Electron,
  nunca `cat > archivo.js <<EOF`.

## Si tuviera que elegir la siguiente tarea

En orden de impacto probable:

1. Ejecutar las habilidades de los 4 jefes automáticamente (o al menos
   ofrecer un botón "aplicar habilidad X" en el aviso existente, en vez de
   dejar que el jugador las replique a mano desde Herramientas genéricas).
2. Mejorar la IA para que use Herramientas — aunque sea con una heurística
   simple (tirar dado cuando toque, aplicar +1/-1 ataque al azar) — antes de
   intentar medir balance en serio.
3. Congelar una suite de pruebas real (no scripts desechables) para las
   invariantes ya validadas manualmente: suma de sangre = 30, un solo
   activo del jugador, condiciones de victoria, cerrojo de campaña lineal.

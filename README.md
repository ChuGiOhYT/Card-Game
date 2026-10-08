# AETERNUM — Juego de mesa y aventura de rol

Juego de cartas por turnos para escritorio (Electron). Sin dependencias en
tiempo de ejecución: todo el juego es HTML, CSS y JavaScript plano cargado
localmente.

## Ejecutar

```bash
npm install
npm start
```

Para abrir con DevTools: `npm run dev`.

> **Si `npm install` deja `node_modules/electron/dist` casi vacío**, la descarga
> del binario se completó pero la extracción falló. Extrae a mano el zip de
> `%LOCALAPPDATA%\electron\Cache\<hash>\` dentro de `node_modules/electron/dist`
> y crea `node_modules/electron/path.txt` con el texto `electron.exe`
> (sin salto de línea final).

## Reglas

**No hay mazo ni robo.** Antes del duelo eliges **5 personajes** de tu raza y
**8 acciones**. Eso es todo lo que tendrás.

**La sangre es vida y poder a la vez.** Cada jugador arranca con 30 sangres
intactas. Lo que se derrama se resta a la vida y, simultáneamente, marca tu
energía disponible. La energía **no se gasta**: es un umbral. Puedes desplegar
cualquier personaje cuyo coste sea ≤ sangre derramada.

La sangre se derrama por dos vías: **1 automática de cada jugador al cerrar
cada turno**, y el daño de combate. De ahí la tensión central del sistema:
golpear al rival lo acerca a la muerte pero le desbloquea personajes mejores.

**Un personaje activo por bando**, los otros 4 en reserva.

**Las acciones activan al personaje.** Un personaje sin acción no tiene ni
ataque ni defensa operativos:

| Acción acoplada | Efecto |
| --- | --- |
| Ataque | Activa el ATAQUE del personaje (+bonus de la carta) |
| Defensa | Activa la DEFENSA del personaje (+bonus de la carta) |
| Neutral | No activa nada: el daño lo atraviesa y va directo a la sangre |

Las acciones son **reutilizables**: al desacoplarlas vuelven a tu reserva.

**Turno:** personaje → acción → ataque → fin.

**Resolución de combate** (atacante contra el activo rival):

| Postura del defensor | Atacante supera | Resultado |
| --- | --- | --- |
| Ataque | sí | Defensor destruido, **la diferencia** pasa como daño |
| Ataque | no | Ataque fallido: nadie muere, no pasa daño |
| Defensa | sí | Defensor destruido, **sin** daño a la sangre |
| Defensa | no | Ataque fallido |
| Neutral | — | El personaje **sobrevive**, todo el ataque va a la sangre |
| Sin defensor | — | Todo el ataque va a la sangre |

**Información oculta:** la acción acoplada del rival no se ve. Pero toda carta
que pisa el campo y se retira —por cambio o por destrucción— queda **revelada
el resto del duelo**.

Pierde quien derrama sus 30 sangres.

## Las cartas

Las 45 cartas jugables son las de `Aeternum TCG/Assets base`, transcritas a
mano desde las imágenes.

**Los JSON son la fuente de verdad.** `characters-source.json` y
`actions-source.json` contienen la transcripción literal (valores, texto de
efecto y cita). De ahí se generan los `.js` que carga la app:

```bash
npm run datos
```

No edites `src/js/data/characters.js` ni `actions.js` a mano: se sobrescriben.

**28 personajes** — 6 por raza más 4 mercenarios. Los costes son cuatro
escalones: **0 / 3 / 7 / 10**, y los mercenarios cuestan 5 fijo con 4/4.
Reanimado es la única raza sin carta de coste 10, a cambio de tener dos de
coste 0.

**17 acciones** — 5 ofensivas, 5 defensivas y 7 neutrales. Cuatro exigen
controlar un personaje de una raza concreta (una por raza).

**Las imágenes** están reescaladas a 620 px de ancho en JPEG dentro de
`src/assets/cartas/`: 191 MB de PNG originales quedan en 5,5 MB sin perder
legibilidad. `manifiesto.json` mapea cada original con su versión optimizada.

## Dónde está cada cosa

- **[MAPA.md](MAPA.md)** — índice generado de todos los módulos y funciones
  con su archivo y línea. Se regenera con `npm run mapa`.
- **[CLAUDE.md](CLAUDE.md)** — convenciones, decisiones de diseño y trampas
  conocidas. Escrito a mano.

## Estructura

```
CLAUDE.md            Guía de trabajo: convenciones y trampas
MAPA.md              GENERADO — índice de funciones (npm run mapa)
main.js              Proceso principal de Electron: ventana + IPC de guardado
preload.js           Puente seguro (contextIsolation) -> window.gameAPI
tools/
  generar-datos.js   Genera los .js de datos desde los *-source.json
  generar-mapa.js    Genera MAPA.md leyendo el propio código
src/
  index.html         Punto de entrada; carga los scripts en orden
  css/styles.css     Hoja de estilos única
  assets/cartas/     Las 50 cartas optimizadas + manifiesto
  js/
    data/*-source.json   Transcripción literal de las cartas (fuente de verdad)
    data/characters.js   GENERADO — 28 personajes
    data/actions.js      GENERADO — 17 acciones
    data/races.js        Las 4 razas jugables + mercenarios
    core/state.js        Perfil persistente y estado de sesión
    core/router.js       Navegación entre pantallas
    core/team.js         Construcción y validación de equipos (5 + 8)
    core/combat.js       Resolución de combate
    core/turnEngine.js   Sangre, fases, despliegue y fin de duelo
    core/ai.js           IA rival (heurística simple)
    screens/             Una pantalla por archivo
    app.js               Arranque: registra pantallas y lanza el menú
```

## Estado actual

Funcionando y verificado:

- Menú, selección de raza y modo historia con desbloqueo progresivo por
  capítulos (ganar desbloquea el siguiente; perder no).
- Constructor de equipos con las cartas reales: 5 personajes + 8 acciones,
  validación completa y aviso cuando eliges una acción atada a otra raza.
- Duelo jugable contra la IA con las cartas reales: despliegue por coste,
  acoplado de acciones, ataque, derrame automático y victoria por sangre.
- Las 6 reglas de resolución de combate, verificadas caso por caso.
- Modelo de sangre de tres pilas, con la suma invariante en 30.
- Revelado permanente al retirarse del campo o al ser destruido.
- La acción del rival permanece boca abajo.
- Lupa: al pasar el ratón por cualquier carta se ve completa en el lateral.
- **El Hades como zona real** (`core/hades.js`), abierta a ambos jugadores:
  entrada desde el puesto activo o desde la reserva, salida de vuelta al
  equipo con pago opcional de sangre, y las consultas que piden las cartas
  (contar por raza, ataque total, buscar una carta concreta, recuperables
  por coste). Se ve en la mesa con miniaturas.

Pendiente:

- **Los efectos impresos de las cartas no se ejecutan todavía.** El texto se
  muestra y se vuelca al registro para aplicarlo a mano, pero el motor no
  resuelve ninguno de forma automática. Falta la infraestructura de dados,
  bloqueos temporales y revelado selectivo. El Hades, en cambio, ya está
  listo para que sus ocho cartas se enchufen.
- La IA es una heurística básica; ignora los efectos por completo.
- En modo historia el rival usa una raza fija y el equipo predeterminado.
- Balance: en simulación IA contra IA (sin efectos), Desterrado gana 6 de sus
  duelos y Oxitrón y Reanimado solo 1 cada uno. Con los efectos sin
  implementar el dato dice poco, porque justo esas dos razas son las que más
  dependen de ellos.

## Guardado

Se escribe en `savegame.json` dentro de la carpeta de datos de usuario de
Electron (`app.getPath('userData')`), no en el repositorio.

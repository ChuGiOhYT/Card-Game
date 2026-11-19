(async function arrancar() {
  const G = window.Game;

  await G.State.cargar();

  // Las gemas llegaron después que la campaña: quien ya tenía calabozos
  // terminados se quedaría sin la suya. Esto solo añade, nunca quita.
  G.State.sincronizarGemas();

  G.Router.registrar('mainMenu', G.Screens.mainMenu);
  G.Router.registrar('seleccionRaza', G.Screens.seleccionRaza);
  G.Router.registrar('historia', G.Screens.historia);
  G.Router.registrar('modoSolo', G.Screens.modoSolo);
  G.Router.registrar('constructor', G.Screens.constructor);
  G.Router.registrar('partida', G.Screens.partida);
  G.Router.registrar('remoto', G.Screens.remoto);

  G.Audio.precargar();

  // Un solo oyente para todos los botones del juego, en vez de repetirlo en
  // cada pantalla. Va en fase de captura por dos motivos: suena antes de que
  // el manejador del botón haga su trabajo, y `Router.actual` todavía apunta
  // a la pantalla donde se pulsó, que es la que decide qué pista toca —si se
  // escuchara al burbujear, un botón que cambia de pantalla sonaría con el
  // sonido del destino.
  document.addEventListener(
    'click',
    (ev) => {
      const boton = ev.target.closest('button');
      if (!boton || boton.disabled) return;
      G.Audio.reproducir(G.Router.actual === 'partida' ? 'partida' : 'menu');
    },
    true
  );

  G.Router.iniciar(document.getElementById('app'), 'mainMenu');
})();

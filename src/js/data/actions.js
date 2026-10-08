/**
 * ARCHIVO GENERADO — no editar a mano.
 * Fuente: src/js/data/*-source.json  ·  Regenerar: npm run datos
 */
window.Game = window.Game || {};

window.Game.ACTIONS = [
  {
    id: "o_captura",
    nombre: "Captura",
    tipo: "ofensiva",
    timing: "Acción equipada",
    texto: "Acción equipada: Declara un coste de sangres, tu oponente revela o selecciona un personaje en su zona de equipos con el coste declarado si tiene un personaje con la cantidad declarada ponlo en posición reemplazando a cualquiera allí. Si no tiene uno, no pasa nada.",
    imagen: "assets/cartas/o-captura.jpg",
    mecanicas: ["declarar_coste","zona_de_equipos","forzar_posicion"]
  },
  {
    id: "o_luna_sangrienta",
    nombre: "Convocar luna sangrienta",
    tipo: "ofensiva",
    timing: "Acción equipada",
    texto: "Acción equipada: Paga una sangre derramada, tu monstruo \"Lunaria\" gana 2 de ataque durante la batalla.",
    imagen: "assets/cartas/o-convocar-luna-sangrienta.jpg",
    razaRequerida: "lunaria",
    mecanicas: ["pagar_sangre_derramada","restringida_por_raza"]
  },
  {
    id: "o_finta",
    nombre: "Finta",
    tipo: "ofensiva",
    timing: "Fase de combate",
    texto: "Fase de combate: Lanza un dado de seis caras, y aplica el efecto que corresponda al resultado obtenido: 1-2: Ataque Normal +0. 3-4: Ataque Certero +1. 5-6: Golpe Crítico +2.",
    imagen: "assets/cartas/o-finta2.jpg",
    mecanicas: ["dado_d6"]
  },
  {
    id: "o_inmolacion",
    nombre: "Inmolación",
    tipo: "ofensiva",
    timing: "Fase de combate",
    texto: "Fase de combate: Duplica el ataque de tu monstruo en posición durante un ataque, pero si batalla, es destruido al final de la fase de combate.",
    imagen: "assets/cartas/o-inmolacion2.jpg",
    mecanicas: ["duplicar_ataque","autodestruccion"]
  },
  {
    id: "o_rompescudos",
    nombre: "Rompescudos",
    tipo: "ofensiva",
    timing: "Fase de combate",
    texto: "Fase de Combate: Los efectos de las cartas de acción son negados.",
    imagen: "assets/cartas/o-rompescudos2.jpg",
    mecanicas: ["negar_acciones"]
  },
  {
    id: "o_sabotaje",
    nombre: "Sabotaje",
    tipo: "ofensiva",
    timing: "Cualquier fase",
    texto: "Cualquier fase: Si tu oponente lanza un dado, aplica -2 al resultado de éste.",
    imagen: "assets/cartas/o-sabotaje.jpg",
    mecanicas: ["modificar_dado"]
  },
  {
    id: "d_acrobatico",
    nombre: "Acrobático",
    tipo: "defensiva",
    timing: "Fase de combate",
    texto: "Fase de combate: Lanza un dado de seis caras, y aplica el efecto que corresponda al resultado obtenido: 1, 2: Ataque total oponente -1. 3, 4: Ataque total oponente -2. 5, 6: Evades el ataque oponente.",
    imagen: "assets/cartas/d-acrobatico2.jpg",
    mecanicas: ["dado_d6","reducir_ataque","evadir"]
  },
  {
    id: "d_biomecanica",
    nombre: "Biomecánica",
    tipo: "defensiva",
    timing: "Fase de combate",
    texto: "Fase de combate: Devuelve esta carta a la zona de acciones, revela un personaje en tu zona de equipo (si se encuentra revelado selecciónalo), equípalo al personaje activo sumando su ataque defensa, pero envíalo al hades al finalizar el turno.",
    imagen: "assets/cartas/d-biomecanica.jpg",
    mecanicas: ["devolver_a_zona_acciones","equipar_personaje","sumar_stats","enviar_al_hades"]
  },
  {
    id: "d_bloquear",
    nombre: "Bloquear",
    tipo: "defensiva",
    timing: "Fase de combate",
    texto: "Fase de combate: Lanza un dado de seis caras, y aplica el efecto que corresponda al resultado obtenido: 1, 6: El ataque es negado, y el oponente recibe daño igual a la defensa de tu personaje. 2, 3: +2 a la defensa de este personaje. 4, 5: +3 a la defensa del personaje",
    imagen: "assets/cartas/d-bloquear2.jpg",
    mecanicas: ["dado_d6","negar_ataque","dano_reflejado"]
  },
  {
    id: "d_campo_caotico",
    nombre: "Campo caótico",
    tipo: "defensiva",
    timing: "Fase de combate",
    texto: "Fase de combate: Puedes elegir si usar la defensa del personaje activo o permitir un ataque directo.",
    imagen: "assets/cartas/d-campo-caotico.jpg",
    mecanicas: ["modal","permitir_ataque_directo"]
  },
  {
    id: "d_encadenar",
    nombre: "Encadenar",
    tipo: "defensiva",
    timing: "Acción equipada",
    texto: "Acción equipada: Si controlas un personaje \"Oxitrón\" paga una sangre derramada, tu oponente cambia el personaje en posición del oponente por otro ya revelado, no podrá utilizar el personaje retirado por un turno.",
    imagen: "assets/cartas/d-encadenar.jpg",
    razaRequerida: "oxitron",
    mecanicas: ["pagar_sangre_derramada","restringida_por_raza","cambio_forzado_rival","bloqueo_temporal"]
  },
  {
    id: "d_escape",
    nombre: "Escape",
    tipo: "defensiva",
    timing: "Fase de combate",
    texto: "Fase de combate: Cambia al personaje en posición por otro con igual o menor requisito de sangres, y devuelve esta carta a la zona de acciones.",
    imagen: "assets/cartas/d-escape2.jpg",
    mecanicas: ["cambio_forzado_propio","devolver_a_zona_acciones"]
  },
  {
    id: "n_comodin",
    nombre: "Comodín",
    tipo: "neutral",
    timing: "Cualquier fase",
    texto: "Cualquier fase: Puedes devolver esta carta a la zona de acciones, activa otra carta de acción que esté revelada a tu personaje en posición.",
    imagen: "assets/cartas/n-comodin2.jpg",
    mecanicas: ["devolver_a_zona_acciones","activar_otra_accion"]
  },
  {
    id: "n_devocion",
    nombre: "Devoción",
    tipo: "neutral",
    timing: "Acción equipada",
    texto: "Acción equipada: Envía el personaje activo al hades, recupera sangres desde la pila de gasto a tu pila de sangres, iguales a su coste.",
    imagen: "assets/cartas/n-devocion.jpg",
    mecanicas: ["enviar_al_hades","recuperar_sangre"]
  },
  {
    id: "n_diplomatico",
    nombre: "Diplomático",
    tipo: "neutral",
    timing: "Acción equipada",
    texto: "Acción Equipada: Paga dos sangres, este y el siguiente turnos no pueden declararse ataques.",
    imagen: "assets/cartas/n-diplomatico2.jpg",
    mecanicas: ["pagar_sangre","prohibir_ataques"]
  },
  {
    id: "n_investigar",
    nombre: "Investigar",
    tipo: "neutral",
    timing: "Acción equipada",
    texto: "Acción equipada: Revela una de las cartas de acción o de personaje de tu oponente.",
    imagen: "assets/cartas/n-investigar2.jpg",
    mecanicas: ["revelar_rival"]
  },
  {
    id: "n_llamada",
    nombre: "Llamada",
    tipo: "neutral",
    timing: "Acción equipada",
    texto: "Acción equipada: Selecciona un personaje \"Reanimado\" en el hades, paga sangres iguales a su coste, devuélvelo a la zona de equipo.",
    imagen: "assets/cartas/n-llamada.jpg",
    razaRequerida: "reanimado",
    mecanicas: ["pagar_sangre","revivir_desde_hades","restringida_por_raza"]
  },
  {
    id: "n_ocultamiento",
    nombre: "Ocultamiento",
    tipo: "neutral",
    timing: "Acción equipada",
    texto: "Acción equipada: Si controlas un personaje \"Desterrado\" Selecciona hasta dos otras cartas de acción del campo, voltéalas boca abajo.",
    imagen: "assets/cartas/n-ocultamiento.jpg",
    razaRequerida: "desterrado",
    mecanicas: ["ocultar_cartas","restringida_por_raza"]
  },
  {
    id: "n_ruego",
    nombre: "Ruego al eterno",
    tipo: "neutral",
    timing: "Acción equipada",
    texto: "Acción equipada: Derrama dos sangres.",
    imagen: "assets/cartas/n-ruego-al-eterno.jpg",
    mecanicas: ["derramar_sangre"]
  }
];

window.Game.ACTIONS_BY_ID = window.Game.ACTIONS.reduce((a, c) => {
  a[c.id] = c;
  return a;
}, {});

window.Game.TIPOS_ACCION = ['ofensiva', 'defensiva', 'neutral'];

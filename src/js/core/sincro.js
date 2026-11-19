/**
 * Sincro: el estado del motor convertido en una FOTO que viaja por la red
 * (duelo remoto, tanda 2), y de vuelta.
 *
 * - Genérico: recorre los campos del motor sin saber cuáles son, así un campo
 *   nuevo del motor viaja solo. Se saltan las funciones (alElegir, alCambiar…).
 * - Conserva las REFERENCIAS: un objeto que aparece dos veces llega como el
 *   mismo objeto (`{$r: id}`), y los `Set` como `Set`. La pantalla compara
 *   jugadores por identidad (`m.jugadorActivo === m.jugadores[0]`).
 * - Oculta al que mira lo que no puede ver del otro (`vistaPara`): sus cartas
 *   boca abajo (acciones libres, personajes de la reserva, la lista del
 *   equipo) van como `?1`, `?2`… según su sitio, y las opciones de una
 *   elección que apunten a una de ellas usan esa misma marca. Lo revelado, lo
 *   que está en posición, el Hades y el vacío son públicos.
 * - El registro va recortado a las últimas líneas (la mesa pinta 80).
 *
 * No toca el DOM.
 */
window.Game = window.Game || {};

window.Game.Sincro = {
  LINEAS_REGISTRO: 80,
  ANUNCIOS: 30,
  /** Campos del motor que no viajan. */
  FUERA: new Set(['alCambiar', 'registro', 'anuncios', '_red']),

  /* --------------------------- Grafo ↔ JSON ---------------------------- */

  aGrafo(raiz) {
    const ids = new Map();
    let n = 0;
    const ir = (v) => {
      if (typeof v === 'function') return undefined;
      // Infinity (bloqueo «mientras siga en posición») no sobrevive a JSON.
      if (typeof v === 'number' && !Number.isFinite(v)) return { $num: String(v) };
      if (v === null || typeof v !== 'object') return v;
      if (ids.has(v)) return { $r: ids.get(v) };
      const id = ++n;
      ids.set(v, id);
      if (v instanceof Set) return { $id: id, $set: [...v].map(ir) };
      if (v instanceof Map) return { $id: id, $map: [...v].map(([k, x]) => [ir(k), ir(x)]) };
      if (Array.isArray(v)) return { $id: id, $arr: v.map(ir) };
      const o = {};
      for (const k of Object.keys(v)) {
        const x = v[k];
        if (typeof x === 'function') continue;
        o[k] = ir(x);
      }
      return { $id: id, $obj: o };
    };
    return ir(raiz);
  },

  deGrafo(g) {
    const vistos = new Map();
    const ir = (v) => {
      if (v === null || typeof v !== 'object') return v;
      if (v.$r !== undefined) return vistos.get(v.$r);
      if (v.$num !== undefined) return Number(v.$num);
      if (v.$set) {
        const s = new Set();
        vistos.set(v.$id, s);
        v.$set.forEach((x) => s.add(ir(x)));
        return s;
      }
      if (v.$map) {
        const m = new Map();
        vistos.set(v.$id, m);
        v.$map.forEach(([k, x]) => m.set(ir(k), ir(x)));
        return m;
      }
      if (v.$arr) {
        const a = [];
        vistos.set(v.$id, a);
        v.$arr.forEach((x) => a.push(ir(x)));
        return a;
      }
      const o = {};
      vistos.set(v.$id, o);
      for (const k of Object.keys(v.$obj)) o[k] = ir(v.$obj[k]);
      return o;
    };
    return ir(g);
  },

  /* ------------------------------- Fotos ------------------------------- */

  /**
   * La foto del motor tal como la debe ver el jugador `paraIdx`. Devuelve
   * { campos, registro, anuncios, marcas } — `marcas` (marca → id real) se
   * queda en el anfitrión para traducir lo que conteste el invitado.
   */
  foto(motor, paraIdx) {
    const campos = {};
    for (const k of Object.keys(motor)) if (!this.FUERA.has(k)) campos[k] = motor[k];
    // Copia profunda para poder tapar sin tocar el motor de verdad.
    const copia = this.deGrafo(this.aGrafo(campos));
    const marcas = this.vistaPara(copia, motor, paraIdx);
    return {
      grafo: this.aGrafo(copia),
      registro: motor.registro.slice(-this.LINEAS_REGISTRO),
      nRegistro: motor.registro.length,
      anuncios: (motor.anuncios || []).slice(-this.ANUNCIOS),
      marcas
    };
  },

  /** Tapa en `copia` lo que `paraIdx` no ve del otro jugador. */
  vistaPara(copia, motor, paraIdx) {
    const marcas = {};
    const otroIdx = 1 - paraIdx;
    const real = motor.jugadores[otroIdx];
    const j = copia.jugadores[otroIdx];
    if (!j) return marcas;
    const visto = real.revelados;
    const enUso = new Set(real.activos.map((i) => i.accion).filter(Boolean));
    let k = 0;
    const marca = (id) => {
      const m = `?${++k}`;
      marcas[m] = id;
      return m;
    };
    const deId = {}; // id real → primera marca (para las opciones de elección)
    j.acciones = real.acciones.map((id) => {
      if (enUso.has(id) || visto.has(id)) return id;
      const m = marca(id);
      deId[id] = deId[id] || m;
      return m;
    });
    j.reserva.forEach((inst, i) => {
      const id = real.reserva[i].personaje;
      if (visto.has(id)) return;
      const m = marca(id);
      deId[id] = deId[id] || m;
      inst.personaje = m;
      inst.accion = null;
      inst.modificadores = { ataque: 0, defensa: 0 };
    });
    const publicos = new Set([...real.activos, ...real.hades, ...(real.vacio || [])].map((i) => i.personaje));
    j.equipo = real.equipo.map((id) => (visto.has(id) || publicos.has(id) ? id : '?'));
    // Una elección (de cualquiera de los dos) cuyas opciones son cartas ocultas
    // del otro: la opción lleva la marca, nunca el id. Y nunca viajan ids de
    // las opciones del OTRO jugador que sean cartas suyas ocultas.
    const e = copia.eleccionPendiente;
    if (e && e.opciones) {
      e.opciones = e.opciones.map((o) => (deId[o.id] ? { ...o, id: deId[o.id] } : o));
      // La pregunta del OTRO: se sabe que está eligiendo, no entre qué (sus
      // opciones pueden nombrar cartas de su mano: Escape, Lyla…).
      if (e.jugadorIdx === otroIdx) e.opciones = e.opciones.map((o, i) => ({ id: `#${i}`, texto: '…' }));
    }
    return marcas;
  },

  /**
   * Vuelca una foto sobre el motor espejo SIN cambiar su identidad: la
   * pantalla guarda `this.motor` y lo compara en sus temporizadores. Los
   * campos que no cambiaron conservan el mismo objeto (así un ataque pendiente
   * no parece «nuevo» en cada foto).
   */
  aplicar(espejo, foto) {
    const nuevos = this.deGrafo(foto.grafo);
    const textos = espejo._textos || {};
    const nuevosTextos = {};
    // Solo se quita lo que trajo una foto anterior (no `yo`, `soltar`…).
    for (const k of Object.keys(textos)) if (!(k in nuevos)) delete espejo[k];
    for (const k of Object.keys(nuevos)) {
      // Sin los números internos ($id), que cambian si crece otro campo.
      const t = JSON.stringify(foto.grafo.$obj[k]).replace(/"\$id":\d+,?/g, '');
      nuevosTextos[k] = t;
      // Solo se reutiliza lo que no enlaza con otros campos ($r), o se
      // romperían las referencias compartidas.
      if (textos[k] === t && !t.includes('"$r"') && k in espejo) continue;
      espejo[k] = nuevos[k];
    }
    espejo._textos = nuevosTextos;
    espejo.registro = foto.registro;
    espejo.nRegistro = foto.nRegistro;
    espejo.anuncios = foto.anuncios;
    return espejo;
  }
};

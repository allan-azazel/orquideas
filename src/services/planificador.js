// Revisa cada 30 segundos si algún riego del calendario debe avisar ahora (RF2).
const riegos = require('../models/riegoModel');
const notificador = require('./notificador');
const { ahora, diaSemana, sumarDias, minutosDelDia } = require('../utils/tiempo');

const VENTANA_MIN = 60;      // si el servidor estuvo apagado más de 1 h, ese aviso se descarta
const INTERVALO_MS = 30000;
let ocupado = false;

async function revisar() {
  if (ocupado) return;
  ocupado = true;
  try {
    const { fecha, hora } = ahora();
    const candidatos = await riegos.candidatosParaAvisar(fecha);
    for (const r of candidatos) {
      const aplicaHoy = r.fecha === fecha
        || (r.repetir_semanal && diaSemana(r.fecha) === diaSemana(fecha));
      if (!aplicaHoy) continue;

      const atraso = minutosDelDia(hora) - minutosDelDia(r.hora);
      if (atraso < 0) continue;                                   // todavía no es la hora

      const reclamado = await riegos.reclamarAvisoDeHoy(r.id_riego, fecha);
      if (!reclamado) continue;                                   // otra revisión ya lo tomó
      if (atraso > VENTANA_MIN) {
        console.warn(`[planificador] Riego #${r.id_riego} omitido: pasó más de ${VENTANA_MIN} min de la hora`);
        continue;
      }
      console.log(`[planificador] Avisando riego #${r.id_riego} (${r.fecha} ${r.hora})`);
      await notificador.notificarRiego(r, fecha);
    }
  } catch (err) {
    console.error('[planificador]', err.message);
  } finally {
    ocupado = false;
  }
}

// Próximo riego a partir de ahora (para mostrarlo en la pantalla)
function proximoRiego(lista) {
  const { fecha: hoy, hora } = ahora();
  const ahoraMin = minutosDelDia(hora);
  let mejor = null;
  const considerar = (r, fecha) => {
    const clave = `${fecha} ${r.hora}`;
    if (!mejor || clave < mejor.clave) mejor = { clave, fecha, hora: r.hora, id_riego: r.id_riego, nota: r.nota };
  };
  for (const r of lista) {
    if (!r.repetir_semanal) {
      const futuro = r.fecha > hoy || (r.fecha === hoy && minutosDelDia(r.hora) > ahoraMin);
      if (futuro) considerar(r, r.fecha);
      continue;
    }
    for (let i = 0; i <= 7; i++) {
      const f = sumarDias(hoy, i);
      if (f < r.fecha || diaSemana(f) !== diaSemana(r.fecha)) continue;
      if (i === 0 && minutosDelDia(r.hora) <= ahoraMin) continue;
      considerar(r, f);
      break;
    }
  }
  return mejor;
}

function iniciar() {
  revisar();
  setInterval(revisar, INTERVALO_MS);
}

module.exports = { iniciar, revisar, proximoRiego };

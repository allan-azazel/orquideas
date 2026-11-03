// Utilidades de fecha y hora en la zona horaria del invernadero (por defecto Chile).
const ZONA = process.env.ZONA_HORARIA || 'America/Santiago';

const formateador = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23'
});

// { fecha: 'YYYY-MM-DD', hora: 'HH:MM:SS' } según la zona horaria configurada
function ahora() {
  const p = {};
  for (const parte of formateador.formatToParts(new Date())) p[parte.type] = parte.value;
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}:${p.second}` };
}

// 0 = domingo ... 6 = sábado
function diaSemana(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function sumarDias(fecha, dias) {
  const [y, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

function minutosDelDia(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function fechaLegible(fecha) {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

module.exports = { ZONA, ahora, diaSemana, sumarDias, minutosDelDia, fechaLegible };

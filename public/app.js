// Interfaz del Monitor de Orquídeas: calendario de riego, notificaciones y condiciones.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const CANAL_TXT = { correo: 'Correo', whatsapp: 'WhatsApp', ambos: 'Correo y WhatsApp' };

const $ = (sel) => document.querySelector(sel);
const estado = { hoy: null, mes: null, seleccionado: null, riegos: [] };

// Crea elementos sin usar innerHTML (los textos nunca se interpretan como HTML)
function h(tag, props = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

async function api(ruta, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + ruta, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || 'Ocurrió un error inesperado.');
  return datos;
}

function mensaje(selector, texto, tipo) {
  const el = $(selector);
  el.className = 'msg' + (tipo ? ' ' + tipo : '');
  el.replaceChildren(...(Array.isArray(texto) ? texto : [texto]));
}

// ---------- Fechas ----------
const pad = (n) => String(n).padStart(2, '0');
const fechaTexto = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const diaSemana = (f) => { const [y, m, d] = f.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const fechaLegible = (f) => { const [y, m, d] = f.split('-'); return `${DIAS[diaSemana(f)]} ${Number(d)} de ${MESES[Number(m) - 1]} de ${y}`; };
const fechaCorta = (f) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}`; };

function riegosDelDia(fecha) {
  return estado.riegos.filter((r) =>
    r.fecha === fecha || (r.repetir_semanal && r.fecha <= fecha && diaSemana(r.fecha) === diaSemana(fecha)));
}

// ---------- Pestañas ----------
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.tabs button').forEach((t) => t.classList.remove('active'));
  $('#' + b.dataset.vista).classList.add('active');
  b.classList.add('active');
  if (b.dataset.vista === 'notificaciones') cargarNotificaciones();
  if (b.dataset.vista === 'condiciones') cargarCondiciones();
}));

// ---------- Estado general y calendario ----------
async function cargarEstado() {
  const e = await api('/estado');
  estado.hoy = e.ahora.fecha;
  if (!estado.mes) estado.mes = { y: Number(e.ahora.fecha.slice(0, 4)), m: Number(e.ahora.fecha.slice(5, 7)) - 1 };
  $('#banner-prueba').hidden = !e.modoPrueba;
  $('#reloj').textContent = `${fechaCorta(e.ahora.fecha)} · ${e.ahora.hora.slice(0, 5)} (${e.zonaHoraria})`;
  $('#proximo').textContent = e.proximoRiego
    ? `${fechaLegible(e.proximoRiego.fecha)} · ${e.proximoRiego.hora}${e.proximoRiego.nota ? ' — ' + e.proximoRiego.nota : ''}`
    : 'Sin riegos programados';
}

async function cargarRiegos() {
  estado.riegos = await api('/riegos');
  dibujarCalendario();
  dibujarTablaRiegos();
}

function dibujarCalendario() {
  const { y, m } = estado.mes;
  $('#mes-titulo').textContent = `${MESES[m]} ${y}`;
  const primero = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;   // semana desde lunes
  const total = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const celdas = [];
  for (let i = 0; i < primero; i++) celdas.push(h('span', { class: 'dia dia-vacio' }));
  for (let d = 1; d <= total; d++) {
    const f = fechaTexto(y, m, d);
    const hay = riegosDelDia(f).length > 0;
    const clases = ['dia'];
    if (f === estado.hoy) clases.push('hoy');
    if (f === estado.seleccionado) clases.push('sel');
    if (hay) clases.push('con-riego');
    celdas.push(h('button', {
      class: clases.join(' '), type: 'button', disabled: f < estado.hoy,
      'aria-label': fechaLegible(f), onclick: () => elegirDia(f)
    }, String(d), hay ? h('span', { class: 'punto' }, '💧') : null));
  }
  $('#cal-celdas').replaceChildren(...celdas);
}

function elegirDia(f) {
  estado.seleccionado = f;
  $('#form-vacio').hidden = true;
  $('#form-riego').hidden = false;
  $('#dia-elegido').textContent = fechaLegible(f);
  mensaje('#msg-riego', '');
  dibujarCalendario();
}

$('#mes-ant').addEventListener('click', () => { cambiarMes(-1); });
$('#mes-sig').addEventListener('click', () => { cambiarMes(1); });
function cambiarMes(delta) {
  const f = new Date(Date.UTC(estado.mes.y, estado.mes.m + delta, 1));
  estado.mes = { y: f.getUTCFullYear(), m: f.getUTCMonth() };
  dibujarCalendario();
}

$('#form-riego').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const boton = ev.target.querySelector('button[type=submit]');
  boton.disabled = true;
  try {
    await api('/riegos', {
      method: 'POST',
      body: {
        fecha: estado.seleccionado,
        hora: $('#hora').value,
        canal: $('#canal').value,
        nota: $('#nota').value,
        repetir_semanal: $('#repetir').checked
      }
    });
    mensaje('#msg-riego', `Riego guardado: te avisaremos el ${fechaLegible(estado.seleccionado)} a las ${$('#hora').value}.`, 'ok');
    $('#nota').value = '';
    $('#repetir').checked = false;
    await Promise.all([cargarRiegos(), cargarEstado()]);
  } catch (err) {
    mensaje('#msg-riego', err.message, 'error');
  } finally {
    boton.disabled = false;
  }
});

function estadoDeRiego(r) {
  if (r.repetir_semanal) return h('span', { class: 'badge info' }, 'Cada semana');
  if (r.ultima_notificacion) return h('span', { class: 'badge ok' }, 'Avisado');
  return h('span', { class: 'badge warn' }, 'Pendiente');
}

function dibujarTablaRiegos() {
  $('#riegos-vacio').hidden = estado.riegos.length > 0;
  $('#tabla-riegos').replaceChildren(...estado.riegos.map((r) => h('tr', {},
    h('td', {}, fechaLegible(r.fecha), r.repetir_semanal ? h('br') : null,
      r.repetir_semanal ? h('small', {}, `se repite los ${DIAS[diaSemana(r.fecha)]}`) : null),
    h('td', {}, r.hora),
    h('td', {}, CANAL_TXT[r.canal]),
    h('td', {}, r.nota || '—'),
    h('td', {}, estadoDeRiego(r)),
    h('td', { class: 'acciones' },
      h('button', { class: 'btn chico sec', type: 'button', onclick: (e) => probarRiego(r, e.target) }, 'Probar ahora'),
      h('button', { class: 'btn chico peligro', type: 'button', onclick: () => eliminarRiego(r) }, 'Eliminar')))));
}

async function probarRiego(r, boton) {
  boton.disabled = true;
  try {
    const { resultados } = await api(`/riegos/${r.id_riego}/probar`, { method: 'POST' });
    mensaje('#msg-riego', resumenEnvio(resultados), resultados.some((x) => x.estado === 'Error') ? 'error' : 'ok');
  } catch (err) {
    mensaje('#msg-riego', err.message, 'error');
  } finally {
    boton.disabled = false;
  }
}

async function eliminarRiego(r) {
  if (!confirm(`¿Eliminar el riego del ${fechaCorta(r.fecha)} a las ${r.hora}?`)) return;
  try {
    await api(`/riegos/${r.id_riego}`, { method: 'DELETE' });
    await Promise.all([cargarRiegos(), cargarEstado()]);
  } catch (err) {
    mensaje('#msg-riego', err.message, 'error');
  }
}

function resumenEnvio(resultados) {
  return [h('span', {}, 'Resultado del envío:'),
    h('ul', {}, resultados.map((x) =>
      h('li', {}, `${CANAL_TXT[x.canal]} → ${x.estado}${x.destino ? ' (' + x.destino + ')' : ''}. ${x.detalle || ''}`)))];
}

// ---------- Notificaciones ----------
async function cargarContacto() {
  const c = await api('/contacto');
  $('#correo').value = c.correo || '';
  $('#whatsapp').value = c.whatsapp || '';
}

$('#form-contacto').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    await api('/contacto', { method: 'PUT', body: { correo: $('#correo').value, whatsapp: $('#whatsapp').value } });
    mensaje('#msg-contacto', 'Contacto guardado.', 'ok');
  } catch (err) {
    mensaje('#msg-contacto', err.message, 'error');
  }
});

$('#btn-prueba').addEventListener('click', async (ev) => {
  ev.target.disabled = true;
  try {
    const { resultados } = await api('/notificaciones/prueba', { method: 'POST', body: { canal: $('#canal-prueba').value } });
    mensaje('#msg-prueba', resumenEnvio(resultados), resultados.some((x) => x.estado === 'Error') ? 'error' : 'ok');
    await cargarNotificaciones();
  } catch (err) {
    mensaje('#msg-prueba', err.message, 'error');
  } finally {
    ev.target.disabled = false;
  }
});

async function cargarNotificaciones() {
  const lista = await api('/notificaciones');
  $('#notif-vacio').hidden = lista.length > 0;
  const clase = { Enviada: 'ok', Simulada: 'info', Error: 'off' };
  $('#tabla-notificaciones').replaceChildren(...lista.map((n) => h('tr', {},
    h('td', {}, n.fecha_hora),
    h('td', {}, n.tipo),
    h('td', {}, CANAL_TXT[n.canal]),
    h('td', {}, n.destino || '—'),
    h('td', {}, h('span', { class: 'badge ' + clase[n.estado] }, n.estado)),
    h('td', {}, h('small', {}, n.detalle || '')))));
}

// ---------- Condiciones ----------
async function cargarCondiciones() {
  const { parametros, ultimas, historial } = await api('/condiciones');
  const hum = (v) => v >= Number(parametros.humedad_min) && v <= Number(parametros.humedad_max);
  const temp = (v) => v >= Number(parametros.temp_min) && v <= Number(parametros.temp_max);
  $('#stats-condiciones').replaceChildren(...ultimas.map((u) => h('div', { class: 'stat' },
    h('span', {}, u.nombre),
    h('strong', {}, `${Number(u.humedad).toFixed(1)} % · ${Number(u.temperatura).toFixed(1)} °C`),
    h('small', {}, `${hum(Number(u.humedad)) && temp(Number(u.temperatura)) ? '✅ Óptimo' : '⚠️ Fuera de rango'} · ${u.fecha_hora}`))));
  $('#tabla-condiciones').replaceChildren(...historial.map((r) => h('tr', {},
    h('td', {}, r.sensor), h('td', {}, `${Number(r.humedad).toFixed(1)} %`), h('td', {}, `${Number(r.temperatura).toFixed(1)} °C`),
    h('td', {}, r.fecha_hora),
    h('td', {}, h('span', { class: 'badge ' + (r.estado === 'Óptimo' ? 'ok' : 'warn') }, r.estado)))));
}

// ---------- Arranque y actualización automática ----------
async function iniciar() {
  try {
    await cargarEstado();
    await Promise.all([cargarRiegos(), cargarContacto()]);
  } catch (err) {
    mensaje('#msg-riego', 'No se pudo conectar con el servidor: ' + err.message, 'error');
  }
}
iniciar();

// Cada 15 s se refresca lo que cambia solo (avisos enviados por el planificador)
setInterval(async () => {
  try {
    await Promise.all([cargarEstado(), cargarRiegos()]);
    if ($('#notificaciones').classList.contains('active')) await cargarNotificaciones();
  } catch (_) { /* si el servidor no responde, se reintenta en el próximo ciclo */ }
}, 15000);

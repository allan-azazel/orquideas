// Envío de notificaciones de riego por correo (SMTP) y WhatsApp (CallMeBot).
const nodemailer = require('nodemailer');
const notificaciones = require('../models/notificacionModel');
const { fechaLegible } = require('../utils/tiempo');

const modoPrueba = () => String(process.env.MODO_PRUEBA).toLowerCase() === 'true';

let transporte = null;
function obtenerTransporte() {
  if (transporte) return transporte;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Falta configurar SMTP_HOST, SMTP_USER y SMTP_PASS en el archivo .env');
  }
  transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: String(SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
  return transporte;
}

async function enviarCorreo(destino, asunto, texto) {
  const info = await obtenerTransporte().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destino,
    subject: asunto,
    text: texto
  });
  return `Correo aceptado por el servidor (${info.messageId})`;
}

async function enviarWhatsapp(destino, texto) {
  const apikey = process.env.CALLMEBOT_APIKEY;
  if (!apikey) throw new Error('Falta CALLMEBOT_APIKEY en el archivo .env');
  const url = 'https://api.callmebot.com/whatsapp.php'
    + `?phone=${encodeURIComponent(destino)}`
    + `&text=${encodeURIComponent(texto)}`
    + `&apikey=${encodeURIComponent(apikey)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    throw new Error('No se pudo conectar con CallMeBot. Revisa tu conexión a internet.');
  }
  const cuerpo = (await res.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
  if (!res.ok || /invalid|error|not valid|not allowed/i.test(cuerpo)) {
    throw new Error(`CallMeBot respondió: ${cuerpo || res.status}`);
  }
  return `WhatsApp aceptado por CallMeBot: ${cuerpo}`;
}

const canalesDe = (canal) => (canal === 'ambos' ? ['correo', 'whatsapp'] : [canal]);

// Envía por un canal y deja el resultado en la tabla notificaciones. Nunca lanza error.
async function enviarPorCanal({ canal, contacto, asunto, mensaje, id_riego = null, tipo = 'Riego' }) {
  const destino = canal === 'correo' ? contacto.correo : contacto.whatsapp;
  let estado;
  let detalle;
  try {
    if (!destino) {
      throw new Error(`No hay ${canal === 'correo' ? 'correo' : 'número de WhatsApp'} configurado`);
    }
    if (modoPrueba()) {
      estado = 'Simulada';
      detalle = 'MODO_PRUEBA=true: no se envió ningún mensaje real';
    } else {
      detalle = canal === 'correo'
        ? await enviarCorreo(destino, asunto, mensaje)
        : await enviarWhatsapp(destino, mensaje);
      estado = 'Enviada';
    }
  } catch (err) {
    estado = 'Error';
    detalle = err.message;
    console.error(`[notificador] ${canal}: ${err.message}`);
  }
  await notificaciones.registrar({ id_riego, tipo, canal, destino, estado, mensaje, detalle });
  return { canal, destino, estado, detalle };
}

function mensajeDeRiego(riego, fecha) {
  const hora = String(riego.hora).slice(0, 5);
  const nota = riego.nota ? ` Nota: ${riego.nota}` : '';
  return `🌸 Es hora de regar tus orquídeas (${fechaLegible(fecha)} ${hora}).${nota}`;
}

async function notificarRiego(riego, fecha, { tipo = 'Riego' } = {}) {
  const contacto = await notificaciones.obtenerContacto();
  const mensaje = (tipo === 'Prueba' ? '(Prueba) ' : '') + mensajeDeRiego(riego, fecha);
  const resultados = [];
  for (const canal of canalesDe(riego.canal)) {
    resultados.push(await enviarPorCanal({
      canal, contacto, asunto: '🌸 Hora de riego – Monitor de Orquídeas',
      mensaje, id_riego: riego.id_riego, tipo
    }));
  }
  return resultados;
}

async function enviarPrueba(canal) {
  const contacto = await notificaciones.obtenerContacto();
  const resultados = [];
  for (const c of canalesDe(canal)) {
    resultados.push(await enviarPorCanal({
      canal: c, contacto, asunto: 'Prueba – Monitor de Orquídeas',
      mensaje: '🌸 Notificación de prueba del Monitor de Orquídeas. Si lees esto, el aviso funciona.',
      tipo: 'Prueba'
    }));
  }
  return resultados;
}

module.exports = { notificarRiego, enviarPrueba, modoPrueba, canalesDe };

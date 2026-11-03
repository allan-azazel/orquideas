const express = require('express');
const riegos = require('../models/riegoModel');
const notificaciones = require('../models/notificacionModel');
const condiciones = require('../models/condicionesModel');
const notificador = require('../services/notificador');
const planificador = require('../services/planificador');
const { ahora, ZONA, minutosDelDia } = require('../utils/tiempo');

const router = express.Router();
const ah = (fn) => (req, res, next) => fn(req, res).catch(next);

const CANALES = ['correo', 'whatsapp', 'ambos'];
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_WHATSAPP = /^\+\d{8,15}$/;

function fechaValida(f) {
  if (!RE_FECHA.test(f)) return false;
  const [y, m, d] = f.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// ---------- Estado general ----------
router.get('/estado', ah(async (req, res) => {
  const lista = await riegos.listar();
  res.json({
    modoPrueba: notificador.modoPrueba(),
    zonaHoraria: ZONA,
    ahora: ahora(),
    proximoRiego: planificador.proximoRiego(lista)
  });
}));

// ---------- Calendario de riego (RF1) ----------
router.get('/riegos', ah(async (req, res) => {
  res.json(await riegos.listar());
}));

router.post('/riegos', ah(async (req, res) => {
  const { fecha, hora, canal, nota, repetir_semanal } = req.body || {};
  if (!fechaValida(fecha)) return res.status(400).json({ error: 'Elige un día válido en el calendario.' });
  if (!RE_HORA.test(hora || '')) return res.status(400).json({ error: 'Elige una hora válida (HH:MM).' });
  if (!CANALES.includes(canal)) return res.status(400).json({ error: 'Elige cómo quieres recibir el aviso.' });
  if (nota && String(nota).length > 160) return res.status(400).json({ error: 'La nota admite hasta 160 caracteres.' });

  const { fecha: hoy, hora: horaActual } = ahora();
  const yaPaso = fecha < hoy || (fecha === hoy && minutosDelDia(hora) <= minutosDelDia(horaActual));
  if (yaPaso) return res.status(400).json({ error: 'Esa fecha y hora ya pasaron. Elige un momento futuro.' });

  const contacto = await notificaciones.obtenerContacto();
  const faltaCorreo = notificador.canalesDe(canal).includes('correo') && !contacto.correo;
  const faltaWhatsapp = notificador.canalesDe(canal).includes('whatsapp') && !contacto.whatsapp;
  if (faltaCorreo || faltaWhatsapp) {
    return res.status(400).json({
      error: `Antes configura tu ${faltaCorreo ? 'correo' : 'número de WhatsApp'} en la pestaña Notificaciones.`
    });
  }

  const id = await riegos.crear({ fecha, hora, canal, nota: nota && String(nota).trim(), repetir_semanal });
  res.status(201).json({ id_riego: id });
}));

router.delete('/riegos/:id', ah(async (req, res) => {
  const ok = await riegos.eliminar(Number(req.params.id));
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Riego no encontrado.' });
}));

// Envía ahora la notificación de un riego (para probarlo en vivo)
router.post('/riegos/:id/probar', ah(async (req, res) => {
  const riego = await riegos.obtener(Number(req.params.id));
  if (!riego) return res.status(404).json({ error: 'Riego no encontrado.' });
  const resultados = await notificador.notificarRiego(riego, ahora().fecha, { tipo: 'Prueba' });
  res.json({ resultados });
}));

// ---------- Notificaciones (RF2) ----------
router.get('/notificaciones', ah(async (req, res) => {
  res.json(await notificaciones.listar());
}));

router.get('/contacto', ah(async (req, res) => {
  res.json(await notificaciones.obtenerContacto());
}));

router.put('/contacto', ah(async (req, res) => {
  const correo = String((req.body || {}).correo || '').trim();
  const whatsapp = String((req.body || {}).whatsapp || '').replace(/[\s-]/g, '');
  if (correo && !RE_CORREO.test(correo)) return res.status(400).json({ error: 'El correo no es válido.' });
  if (whatsapp && !RE_WHATSAPP.test(whatsapp)) {
    return res.status(400).json({ error: 'El WhatsApp debe incluir código de país, por ejemplo +56912345678.' });
  }
  await notificaciones.guardarContacto({ correo, whatsapp });
  res.json({ ok: true });
}));

router.post('/notificaciones/prueba', ah(async (req, res) => {
  const canal = (req.body || {}).canal;
  if (!CANALES.includes(canal)) return res.status(400).json({ error: 'Canal no válido.' });
  res.json({ resultados: await notificador.enviarPrueba(canal) });
}));

// ---------- Condiciones ambientales (datos de ejemplo cargados en la BD) ----------
router.get('/condiciones', ah(async (req, res) => {
  const [parametros, sensores, ultimas, historial] = await Promise.all([
    condiciones.parametros(), condiciones.sensores(), condiciones.ultimasLecturas(), condiciones.historial()
  ]);
  res.json({ parametros, sensores, ultimas, historial });
}));

module.exports = router;

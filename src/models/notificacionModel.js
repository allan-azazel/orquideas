const db = require('../config/db');

async function registrar({ id_riego = null, tipo = 'Riego', canal, destino, estado, mensaje, detalle = null }) {
  await db.query(
    `INSERT INTO notificaciones (id_riego, tipo, canal, destino, estado, mensaje, detalle)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id_riego, tipo, canal, destino || null, estado, mensaje.slice(0, 500), detalle ? String(detalle).slice(0, 300) : null]
  );
}

async function listar(limite = 50) {
  const [filas] = await db.query(
    `SELECT id_notificacion, id_riego, tipo, canal, destino, estado, mensaje, detalle,
            DATE_FORMAT(fecha_hora, '%d/%m/%Y %H:%i') AS fecha_hora
       FROM notificaciones
      ORDER BY id_notificacion DESC
      LIMIT ?`,
    [limite]
  );
  return filas;
}

async function obtenerContacto() {
  const [filas] = await db.query('SELECT correo, whatsapp FROM contacto_notificaciones WHERE id = 1');
  return filas[0] || { correo: null, whatsapp: null };
}

async function guardarContacto({ correo, whatsapp }) {
  await db.query(
    `INSERT INTO contacto_notificaciones (id, correo, whatsapp) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE correo = VALUES(correo), whatsapp = VALUES(whatsapp)`,
    [correo || null, whatsapp || null]
  );
}

module.exports = { registrar, listar, obtenerContacto, guardarContacto };

const db = require('../config/db');

async function listar() {
  const [filas] = await db.query(
    `SELECT id_riego, fecha, TIME_FORMAT(hora, '%H:%i') AS hora, repetir_semanal, canal, nota,
            activo, ultima_notificacion
       FROM calendario_riego
      WHERE activo = 1
      ORDER BY fecha, hora`
  );
  return filas;
}

async function obtener(id) {
  const [filas] = await db.query('SELECT * FROM calendario_riego WHERE id_riego = ?', [id]);
  return filas[0] || null;
}

async function crear({ fecha, hora, repetir_semanal, canal, nota }) {
  const [res] = await db.query(
    `INSERT INTO calendario_riego (fecha, hora, repetir_semanal, canal, nota)
     VALUES (?, ?, ?, ?, ?)`,
    [fecha, hora, repetir_semanal ? 1 : 0, canal, nota || null]
  );
  return res.insertId;
}

// Baja lógica: el historial de notificaciones conserva su referencia
async function eliminar(id) {
  const [res] = await db.query('UPDATE calendario_riego SET activo = 0 WHERE id_riego = ?', [id]);
  return res.affectedRows > 0;
}

// Riegos que podrían avisar hoy y todavía no avisaron hoy
async function candidatosParaAvisar(hoy) {
  const [filas] = await db.query(
    `SELECT id_riego, fecha, hora, repetir_semanal, canal, nota
       FROM calendario_riego
      WHERE activo = 1
        AND fecha <= ?
        AND (ultima_notificacion IS NULL OR ultima_notificacion <> ?)`,
    [hoy, hoy]
  );
  return filas;
}

// Marca el aviso de hoy ANTES de enviar. Si dos revisiones coinciden, solo una lo logra.
async function reclamarAvisoDeHoy(id, hoy) {
  const [res] = await db.query(
    `UPDATE calendario_riego
        SET ultima_notificacion = ?
      WHERE id_riego = ?
        AND (ultima_notificacion IS NULL OR ultima_notificacion <> ?)`,
    [hoy, id, hoy]
  );
  return res.affectedRows === 1;
}

module.exports = { listar, obtener, crear, eliminar, candidatosParaAvisar, reclamarAvisoDeHoy };

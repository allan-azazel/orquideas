const db = require('../config/db');

async function parametros() {
  const [filas] = await db.query('SELECT * FROM parametros_cultivo LIMIT 1');
  return filas[0];
}

async function sensores() {
  const [filas] = await db.query('SELECT id_sensor, nombre, ubicacion, tipo_conexion, estado FROM sensores ORDER BY id_sensor');
  return filas;
}

// Última lectura de cada sensor
async function ultimasLecturas() {
  const [filas] = await db.query(
    `SELECT s.id_sensor, s.nombre, r.humedad, r.temperatura,
            DATE_FORMAT(r.fecha_hora, '%d/%m/%Y %H:%i') AS fecha_hora
       FROM sensores s
       JOIN registros r ON r.id_registro = (
              SELECT id_registro FROM registros WHERE id_sensor = s.id_sensor
               ORDER BY fecha_hora DESC, id_registro DESC LIMIT 1)
      ORDER BY s.id_sensor`
  );
  return filas;
}

async function historial(limite = 30) {
  const [filas] = await db.query(
    `SELECT id_registro, sensor, ubicacion, humedad, temperatura, estado,
            DATE_FORMAT(fecha_hora, '%d/%m/%Y %H:%i') AS fecha_hora
       FROM v_historial
      ORDER BY v_historial.fecha_hora DESC, id_registro DESC
      LIMIT ?`,
    [limite]
  );
  return filas;
}

module.exports = { parametros, sensores, ultimasLecturas, historial };

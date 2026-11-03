// Crea la base de datos y las tablas ejecutando database/schema.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });
  try {
    await conn.query(sql);
    console.log('Base de datos "orquideas_monitor" lista.');
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error('No se pudo crear la base de datos:', err.message);
  process.exit(1);
});

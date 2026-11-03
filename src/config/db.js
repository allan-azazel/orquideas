require('dotenv').config();
const mysql = require('mysql2/promise');

// dateStrings: las fechas llegan como texto 'YYYY-MM-DD' (sin cambios de zona horaria)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'orquideas_monitor',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 5
});

module.exports = pool;

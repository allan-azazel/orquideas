-- Monitoreo de cultivo de orquídeas (MySQL / MariaDB)
-- Se puede ejecutar con:  npm run db:init   o importar en Workbench / phpMyAdmin.

CREATE DATABASE IF NOT EXISTS orquideas_monitor
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE orquideas_monitor;

-- ---------------------------------------------------------------
-- Parámetros ideales del cultivo (humedad ~80 %, temperatura 18–24 °C)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parametros_cultivo (
  id_parametro            INT AUTO_INCREMENT PRIMARY KEY,
  humedad_ideal           DECIMAL(5,2) NOT NULL DEFAULT 80.00,
  humedad_min             DECIMAL(5,2) NOT NULL DEFAULT 75.00,
  humedad_max             DECIMAL(5,2) NOT NULL DEFAULT 85.00,
  temp_min                DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  temp_max                DECIMAL(5,2) NOT NULL DEFAULT 24.00,
  frecuencia_registro_min INT          NOT NULL DEFAULT 60   -- cada cuántos minutos se guarda un registro
);

-- ---------------------------------------------------------------
-- Sensores conectados por Bluetooth o Wi-Fi
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sensores (
  id_sensor      INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(60)  NOT NULL,
  ubicacion      VARCHAR(100) NOT NULL,
  tipo_conexion  ENUM('Bluetooth','Wi-Fi') NOT NULL,
  identificador  VARCHAR(60)  NOT NULL,                      -- MAC o IP
  estado         ENUM('Conectado','Desconectado') NOT NULL DEFAULT 'Desconectado'
);

-- ---------------------------------------------------------------
-- Historial de condiciones ambientales
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registros (
  id_registro  BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_sensor    INT          NOT NULL,
  humedad      DECIMAL(5,2) NOT NULL,                        -- % HR
  temperatura  DECIMAL(5,2) NOT NULL,                        -- °C
  fecha_hora   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_registros_sensor FOREIGN KEY (id_sensor) REFERENCES sensores(id_sensor),
  CONSTRAINT chk_humedad     CHECK (humedad BETWEEN 0 AND 100),
  CONSTRAINT chk_temperatura CHECK (temperatura BETWEEN -50 AND 100)
);
CREATE INDEX idx_registros_fecha ON registros (fecha_hora);

-- ---------------------------------------------------------------
-- Contacto donde llegan las notificaciones (una sola fila, id = 1)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacto_notificaciones (
  id        TINYINT PRIMARY KEY,
  correo    VARCHAR(120) NULL,
  whatsapp  VARCHAR(20)  NULL                                -- con código de país, ej. +56912345678
);

-- ---------------------------------------------------------------
-- Calendario de riego (RF1)
--   fecha            día elegido en el calendario
--   hora             hora elegida
--   repetir_semanal  1 = se repite el mismo día de la semana cada semana
--   canal            por dónde llega el aviso
--   ultima_notificacion  evita avisar dos veces el mismo día
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendario_riego (
  id_riego             INT AUTO_INCREMENT PRIMARY KEY,
  fecha                DATE         NOT NULL,
  hora                 TIME         NOT NULL,
  repetir_semanal      TINYINT(1)   NOT NULL DEFAULT 0,
  canal                ENUM('correo','whatsapp','ambos') NOT NULL DEFAULT 'correo',
  nota                 VARCHAR(160) NULL,
  activo               TINYINT(1)   NOT NULL DEFAULT 1,
  ultima_notificacion  DATE         NULL,
  creado               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- Notificaciones enviadas (RF2): una fila por canal y por envío
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
  id_notificacion  INT AUTO_INCREMENT PRIMARY KEY,
  id_riego         INT NULL,
  tipo             ENUM('Riego','Prueba') NOT NULL DEFAULT 'Riego',
  canal            ENUM('correo','whatsapp') NOT NULL,
  destino          VARCHAR(120) NULL,
  estado           ENUM('Enviada','Simulada','Error') NOT NULL,
  mensaje          VARCHAR(500) NOT NULL,
  detalle          VARCHAR(300) NULL,
  fecha_hora       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_riego FOREIGN KEY (id_riego) REFERENCES calendario_riego(id_riego) ON DELETE SET NULL
);

-- ---------------------------------------------------------------
-- Vista del historial con el estado según los parámetros ideales
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_historial AS
SELECT r.id_registro, s.nombre AS sensor, s.ubicacion,
       r.humedad, r.temperatura, r.fecha_hora,
       CASE
         WHEN r.humedad < p.humedad_min OR r.humedad > p.humedad_max THEN 'Humedad fuera de rango'
         WHEN r.temperatura < p.temp_min OR r.temperatura > p.temp_max THEN 'Temperatura fuera de rango'
         ELSE 'Óptimo'
       END AS estado
FROM registros r
JOIN sensores s ON s.id_sensor = r.id_sensor
CROSS JOIN parametros_cultivo p;

-- ---------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------
INSERT INTO parametros_cultivo (humedad_ideal)
SELECT 80.00 WHERE NOT EXISTS (SELECT 1 FROM parametros_cultivo);

INSERT INTO contacto_notificaciones (id, correo, whatsapp)
SELECT 1, NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM contacto_notificaciones);

INSERT INTO sensores (nombre, ubicacion, tipo_conexion, identificador, estado)
SELECT * FROM (
  SELECT 'Sensor A', 'Invernadero – sector norte', 'Wi-Fi', '192.168.1.45', 'Conectado'
  UNION ALL SELECT 'Sensor B', 'Invernadero – sector sur', 'Bluetooth', 'A4:C1:38:5F:22:9B', 'Conectado'
  UNION ALL SELECT 'Sensor C', 'Vivero – mesón 2', 'Wi-Fi', '192.168.1.52', 'Desconectado'
) AS nuevos
WHERE NOT EXISTS (SELECT 1 FROM sensores);

INSERT INTO registros (id_sensor, humedad, temperatura, fecha_hora)
SELECT * FROM (
  SELECT 1 AS id_sensor, 81.0 AS humedad, 18.2 AS temperatura, TIMESTAMP(CURDATE(), '06:00:00') AS fecha_hora
  UNION ALL SELECT 1, 80.4, 20.5, TIMESTAMP(CURDATE(), '08:00:00')
  UNION ALL SELECT 1, 79.1, 22.8, TIMESTAMP(CURDATE(), '10:00:00')
  UNION ALL SELECT 1, 72.4, 24.3, TIMESTAMP(CURDATE(), '12:00:00')
  UNION ALL SELECT 2, 80.3, 23.1, TIMESTAMP(CURDATE(), '12:00:00')
  UNION ALL SELECT 1, 78.9, 23.7, TIMESTAMP(CURDATE(), '14:00:00')
  UNION ALL SELECT 2, 82.1, 22.4, TIMESTAMP(CURDATE(), '14:00:00')
  UNION ALL SELECT 1, 80.5, 22.9, TIMESTAMP(CURDATE(), '16:00:00')
) AS nuevos
WHERE NOT EXISTS (SELECT 1 FROM registros);

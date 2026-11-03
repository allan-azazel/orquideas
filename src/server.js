require('dotenv').config();
const path = require('path');
const express = require('express');
const api = require('./routes/api');
const planificador = require('./services/planificador');
const notificador = require('./services/notificador');
const { ZONA } = require('./utils/tiempo');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', api);

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((err, req, res, next) => {          // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor. Revisa la consola.' });
});

const PUERTO = Number(process.env.PORT || 3000);
app.listen(PUERTO, () => {
  console.log(`Monitor de Orquídeas en http://localhost:${PUERTO}  (zona horaria: ${ZONA})`);
  console.log(notificador.modoPrueba()
    ? 'MODO_PRUEBA activo: las notificaciones se registran pero NO se envían.'
    : 'Envío real de notificaciones activo.');
  planificador.iniciar();
});

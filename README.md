# Monitor de Cultivo de Orquídeas – Avance #2

Prototipo web (Node.js + Express + MySQL/MariaDB) con:

- **RF1 – Calendario de riego:** eliges un día en el calendario, una hora y cómo quieres el aviso (correo, WhatsApp o ambos). Opcionalmente se repite cada semana.
- **RF2 – Notificar hora de riego:** un planificador revisa cada 30 segundos y, cuando llega el día y la hora, envía el aviso. Cada envío queda registrado en la tabla `notificaciones`.
- Pestaña **Condiciones**: humedad y temperatura leídas desde la base de datos (datos de ejemplo del Avance #1).

## Requisitos

- Node.js 18 o superior
- MySQL o MariaDB funcionando en tu equipo

## Puesta en marcha

```bash
npm install
copy .env.example .env        # en Linux/Mac: cp .env.example .env
```

Abre `.env` y completa al menos `DB_USER` y `DB_PASSWORD`. Después:

```bash
npm run db:init               # crea la base "orquideas_monitor" con sus tablas y datos de ejemplo
npm start                     # abre http://localhost:3000
```

Por defecto `MODO_PRUEBA=true`: el sistema funciona completo pero **no envía mensajes reales**; deja cada aviso como “Simulada” en el historial. Sirve para ensayar sin configurar nada.

## Envío real

1. Pon `MODO_PRUEBA=false` en `.env` y reinicia.
2. **Correo (Gmail):** activa la verificación en 2 pasos, crea una “contraseña de aplicación” y ponla en `SMTP_PASS` (con tu correo en `SMTP_USER` y `SMTP_FROM`).
3. **WhatsApp (CallMeBot, gratuito):** guarda en tu teléfono el número del bot que indica la página de CallMeBot (el número cambia de vez en cuando, verifícalo ahí) y envíale el mensaje `I allow callmebot to send me messages`. Te responderá con una *apikey*; ponla en `CALLMEBOT_APIKEY`. Solo puedes recibir avisos en números que hayas activado así.
4. En la pestaña **Notificaciones** guarda tu correo y tu WhatsApp (con código de país, ej. `+56912345678`) y usa **Enviar prueba ahora** para comprobar que llega.

## Cómo demostrarlo al profesor

1. Pestaña **Notificaciones** → guarda tu contacto → **Enviar prueba ahora**.
2. Pestaña **Calendario de riego** → elige el día de hoy → una hora 2 minutos más adelante → **Guardar riego**.
3. Espera: al llegar la hora el aviso llega solo y aparece en **Notificaciones** → Historial.
   (**Probar ahora** en la lista de riegos envía el aviso al instante.)

## Estructura

```
database/schema.sql          tablas, vista y datos de ejemplo
scripts/init-db.js           ejecuta schema.sql
src/server.js                arranque de Express y del planificador
src/routes/api.js            endpoints y validaciones
src/models/                  consultas SQL (riegos, notificaciones, condiciones)
src/services/notificador.js  envío por correo (SMTP) y WhatsApp (CallMeBot)
src/services/planificador.js revisa el calendario cada 30 s y dispara los avisos
public/                      interfaz (HTML, CSS, JS)
```

## Comportamiento a tener en cuenta

- El servidor debe estar **encendido** a la hora del riego. Si estuvo apagado más de 1 hora después de la hora programada, ese aviso se descarta.
- Cada riego avisa **una sola vez por día**, aunque el planificador revise muchas veces.
- La zona horaria es `America/Santiago` (se cambia con `ZONA_HORARIA` en `.env`).
- Un fallo en un canal (por ejemplo WhatsApp) no impide que el otro se envíe; el error queda en el historial.

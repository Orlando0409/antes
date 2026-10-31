# Design

## Context

`server.js` crea Express y Socket.IO y solo hace `listen` si se ejecuta directo; las pruebas lo importan. Render ejecuta `npm start`. Ver proposal.md para el motivo.

## Goals / Non-Goals

**Goals:**
- Una sola forma de arrancar (`npm start`) en Render, local y Docker; la variable de entorno decide que se activa.
- Correlacion log ↔ traza por `trace_id` sin codigo extra en cada log.

**Non-Goals:**
- Telemetria del navegador.
- Grafana Alloy u otro collector.
- Autenticacion del chat (no existe hoy).

## Decisions

- **OTLP directo a Grafana Cloud** (`http/protobuf`, gateway `.../otlp`). Alternativa: Grafana Alloy en otro contenedor; se descarta por ser una pieza mas sin beneficio para el lab.
- **Inicio en `libs/telemetria.js`, llamado en la primera linea de `server.js`**, antes de `require('express')`, para que las instrumentaciones http y express parcheen los modulos. Alternativa: `node --require`; se descarta porque Render podria arrancar con `node server.js` y perder la instrumentacion.
- **Instrumentaciones http y express individuales** en lugar de `auto-instrumentations-node`, para no cargar decenas de paquetes.
- **Instrumentos (tracer, meter, logger) obtenidos de forma diferida**: el API de metricas no tiene proveedor proxy, asi que un `getMeter` antes de `start()` quedaria en no-op.
- **Sentry 11 sin su propio proveedor OTel** (`enableOpenTelemetrySetup` en su valor por defecto `false`), asi no compite con el SDK de OpenTelemetry.
- **`POST /api/mensajes`** con `express.json({ limit: '10kb' })` para que Artillery use un escenario HTTP. Reusa `validateMessage` y el mismo evento de difusion.
- **Rechazo en Socket.IO**: `validateMessage` no lanza; se considera rechazado cuando devuelve el objeto de `Sistema` con mensaje vacio o `Mensaje invalido`.

## Risks / Trade-offs

- [Un usuario que se llame `Sistema` y escriba `Mensaje invalido` cuenta como rechazado] → solo afecta la metrica, no lo que se difunde.
- [El endpoint HTTP permite enviar mensajes sin navegador] → mismo nivel de riesgo que el socket (no hay autenticacion), con limite de 10 KB y la misma validacion.
- [La ruta `/debug-sentry` permite generar errores] → es temporal; se retira despues de tomar la evidencia.
- [El token queda en `.env` local] → `.env` ya esta en `.gitignore` y `.dockerignore`; `.env.example` va vacio.

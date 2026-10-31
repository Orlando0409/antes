# Proposal

## Why

El laboratorio de monitoreo pide registrar errores de UNA Chat desplegado (Render) con Sentry y enviar logs, metricas y trazas de la ejecucion local a Grafana Cloud, ademas de medir la carga con Artillery. Hoy el chat no emite telemetria y solo recibe mensajes por Socket.IO, que no sirve para un escenario HTTP de Artillery.

## What Changes

- Sentry captura errores del backend cuando existe `SENTRY_DSN` (Render). Ruta temporal `/debug-sentry` para el error controlado, a retirar despues de la evidencia.
- OpenTelemetry exporta trazas, metricas y logs por OTLP directo a Grafana Cloud solo cuando `OTEL_EXPORTER_OTLP_ENDPOINT` tiene valor (equipo local o Docker). Render no lo define, asi que no exporta.
- Cada mensaje genera un span `chat.procesar_mensaje`, un log con su `trace_id` y metricas de cantidad y duracion por canal y resultado.
- Nuevo endpoint `POST /api/mensajes` que pasa por `validateMessage`, difunde el resultado por Socket.IO y responde con el mensaje saneado (201) o 400 si falta `mensaje`.
- `Dockerfile`, `docker-compose.yml`, `.env.example` y escenario de Artillery (`artillery/carga.yml`).

## Capabilities

### New Capabilities
- `monitoreo`: errores en Sentry y exportacion de logs, metricas y trazas a Grafana Cloud solo en el entorno local.

### Modified Capabilities
- `validacion-mensajes`: se agrega la entrada de mensajes por HTTP con la misma validacion obligatoria.

## Impact

- `server.js`, nuevo `libs/telemetria.js`, pruebas en `test/` y `tests/integration/`.
- Dependencias de produccion: `@sentry/node` y paquetes `@opentelemetry/*` (api, sdk-node, sdk-metrics, sdk-logs, resources, exportadores OTLP proto, instrumentaciones http y express). Justificacion: son los SDK oficiales que pide la guia; `npm audit --omit=dev` queda en 0.
- Variables de entorno nuevas: `SENTRY_DSN` (Render) y `OTEL_*` (solo local, en `.env` ignorado por git).

# Tasks

## 1. Dependencias

- [x] 1.1 Instalar `@sentry/node` y los paquetes `@opentelemetry/*` y verificar `npm run security:audit` en 0

## 2. Telemetria

- [x] 2.1 Crear `libs/telemetria.js` (inicio de Sentry y OpenTelemetry, entorno, logs) y verificar con `test/telemetria.test.js` que la exportacion solo se habilita con endpoint y que el entorno por defecto es `local`
- [x] 2.2 Llamar la telemetria al inicio de `server.js`, agregar span, log y metricas por mensaje y verificar que `npm test` y `npm run test:integration` siguen en verde

## 3. Entrada HTTP

- [x] 3.1 Agregar `POST /api/mensajes` y verificar con pruebas de integracion los escenarios 201, script, 400 y 413
- [x] 3.2 Agregar la ruta temporal `/debug-sentry` y verificar con una prueba de integracion que responde 500
- [x] 3.3 Tomar la evidencia de Sentry (issue UNA-CHAT-NODE-1), retirar `/debug-sentry` y verificar con la prueba de integracion que responde 404

## 4. Docker, Artillery y documentacion

- [x] 4.1 Crear `Dockerfile`, `.dockerignore`, `docker-compose.yml` y `.env.example` y verificar que `docker compose up --build` sirve el chat en http://localhost:3000
- [x] 4.2 Crear `artillery/carga.yml` (60 s, 5 llegadas/s, una solicitud por usuario) y verificar que se ejecuta con `npx artillery run`
- [x] 4.3 Documentar en `README.md` variables, comandos y consultas de Grafana Cloud y verificar que los comandos documentados existen en `package.json`

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` despues del PR.

# UNA Chat

Chat en tiempo real (Express + Socket.IO) del curso de Seguridad Informatica, UNA. Permite compartir imagenes, videos y YouTube pegando la URL, con validacion contra inyeccion de scripts (XSS) en `libs/unalib.js`.

## Uso

```bash
npm install
npm start          # http://localhost:3000
```

## Monitoreo (Lab 7)

| Donde | Que | Se activa con |
|---|---|---|
| Render | Errores en Sentry | `SENTRY_DSN` en Render > Environment |
| Local / Docker | Logs, metricas y trazas en Grafana Cloud (OTLP directo) | `OTEL_*` en `.env` |

Render no define `OTEL_*`, asi que el despliegue nunca envia telemetria a Grafana Cloud. El codigo esta en `libs/telemetria.js`.

### Sentry (Render)

1. Proyecto **Node.js** en Sentry → copiar el DSN.
2. Render → servicio → Environment → `SENTRY_DSN=<dsn>` → redeploy.
3. Abrir `https://<app>.onrender.com/debug-sentry` (responde 500) y buscar *Prueba de Sentry en UNA Chat* en Issues.
4. Tomar la evidencia y **retirar** la ruta `/debug-sentry` de `server.js` y su prueba en `tests/integration/chat.test.js`.

### Grafana Cloud (local)

1. Grafana Cloud → **Connections → OpenTelemetry (OTLP)** → generar token. Copiar el endpoint (termina en `/otlp`) y el valor de `OTEL_EXPORTER_OTLP_HEADERS`.
2. `cp .env.example .env` y completar (sin comillas):

```bash
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<region>.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64>
OTEL_SERVICE_NAME=una-chat
OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=local
```

3. Ejecutar con Node (parte 2) o con Docker (parte 3):

```bash
npm run start:local            # Node local, lee .env
docker compose up -d --build   # Docker, http://localhost:3000
docker compose logs -f chat
docker compose down
```

Cada mensaje (socket o HTTP) genera el span `chat.procesar_mensaje` con `chat.canal` y `chat.resultado`, un log dentro de ese span (mismo `trace_id`) y las metricas `chat.mensajes` y `chat.mensaje.duracion`. Las solicitudes HTTP generan `http.server.request.duration` con su codigo de respuesta.

**Fallo controlado:** `POST /api/mensajes` sin `mensaje` responde 400 y queda como `rechazado`:

```bash
curl -X POST http://localhost:3000/api/mensajes -H "Content-Type: application/json" -d '{"nombre":"prueba"}'
```

**Consultas en Grafana Cloud (Explore):**

| Senal | Fuente | Consulta |
|---|---|---|
| Logs | Loki | `{service_name="una-chat"}` |
| Log de una traza | Loki | `{service_name="una-chat"} \| trace_id="<trace_id>"` |
| Trazas | Tempo | `{resource.service.name="una-chat" && name="chat.procesar_mensaje"}` |
| Solicitudes/s por codigo | Prometheus | `sum by (http_response_status_code) (rate(http_server_request_duration_seconds_count{job="una-chat"}[1m]))` |
| Latencia p95 | Prometheus | `histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{job="una-chat"}[1m])))` |
| % errores | Prometheus | `100 * sum(rate(http_server_request_duration_seconds_count{job="una-chat", http_response_status_code=~"4..\|5.."}[1m])) / sum(rate(http_server_request_duration_seconds_count{job="una-chat"}[1m]))` |
| Mensajes por resultado | Prometheus | `sum by (chat_canal, chat_resultado) (rate(chat_mensajes_total{job="una-chat"}[1m]))` |

El entorno `local` aparece como atributo `deployment.environment.name` en logs y trazas.

### Prueba de carga (Artillery, local)

Con el chat en Docker: 5 usuarios/s durante 60 s, una solicitud cada uno (300 en total) a `POST /api/mensajes`.

```bash
npx artillery run artillery/carga.yml --output reports/artillery-carga.json
```

`reports/` esta en `.gitignore`. No ejecutar contra Render.

## Calidad y seguridad

| Capa | Herramienta | Comando |
|---|---|---|
| Especificacion | OpenSpec (`openspec/specs/`) | `npm run spec:validate` |
| Unitarias BDD | Mocha + Chai `expect`, Dado/Cuando/Entonces (`test/`) | `npm test` |
| Integracion | Jest + Supertest + socket.io-client | `npm run test:integration` |
| End-to-end | Playwright (Chromium) | `npm run test:e2e` |
| Dependencias | npm audit / Snyk | `npm run security:audit` / `npm run security:snyk` |
| Codigo (SAST) | Snyk Code | `npm run security:snyk-code` |

`npm run check` corre specs, audit, unitarias e integracion. GitHub Actions (`.github/workflows/ci.yml`) corre todo en cada PR.

### Snyk

1. `npx snyk auth` (abre el navegador para iniciar sesion).
2. `npm run security:snyk` y `npm run security:snyk-code`.
3. Para CI: crear el secret `SNYK_TOKEN` en GitHub (Settings > Secrets and variables > Actions).

## Agentes de IA

Ver [AGENTS.md](AGENTS.md). Flujo spec-driven con OpenSpec: `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

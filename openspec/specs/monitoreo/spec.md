# monitoreo Specification

## Purpose
Permite observar UNA Chat: errores del despliegue en Sentry y logs, metricas y trazas de la ejecucion local en Grafana Cloud, sin credenciales en el codigo.

## Requirements

### Requirement: Exportacion solo con endpoint configurado
El sistema MUST exportar logs, metricas y trazas por OTLP solo cuando `OTEL_EXPORTER_OTLP_ENDPOINT` tiene valor. Sin ese valor no MUST intentar ninguna exportacion.

#### Scenario: Despliegue sin endpoint
- **WHEN** el servidor arranca sin `OTEL_EXPORTER_OTLP_ENDPOINT`
- **THEN** la exportacion queda deshabilitada y el chat funciona igual

#### Scenario: Equipo local con endpoint
- **WHEN** el servidor arranca con `OTEL_EXPORTER_OTLP_ENDPOINT` definido
- **THEN** la exportacion queda habilitada

### Requirement: Entorno de origen identificado
La telemetria exportada SHALL llevar el atributo de recurso `deployment.environment.name`, tomado de `OTEL_RESOURCE_ATTRIBUTES` y con valor `local` cuando no se define.

#### Scenario: Sin atributo definido
- **WHEN** `OTEL_RESOURCE_ATTRIBUTES` no define el entorno
- **THEN** el entorno es `local`

#### Scenario: Atributo definido
- **WHEN** `OTEL_RESOURCE_ATTRIBUTES` es `deployment.environment.name=docker-local`
- **THEN** el entorno es `docker-local`

### Requirement: Traza y log por mensaje
Cada mensaje procesado SHALL generar un span con el canal (`socket` o `http`) y el resultado (`aceptado` o `rechazado`), y un log emitido dentro de ese span para que comparta su `trace_id`. Un mensaje rechazado MUST marcar el span con estado de error.

#### Scenario: Mensaje aceptado
- **WHEN** un cliente envia un mensaje valido
- **THEN** se registra un span con resultado `aceptado` y un log con el mismo `trace_id`

#### Scenario: Mensaje rechazado
- **WHEN** un cliente envia JSON invalido
- **THEN** el span queda con estado de error y resultado `rechazado`

### Requirement: Metricas de mensajes y solicitudes
El sistema SHALL registrar la cantidad y la duracion de las solicitudes HTTP con su codigo de respuesta, y la cantidad y la duracion de los mensajes procesados por canal y resultado.

#### Scenario: Solicitud fallida
- **WHEN** `POST /api/mensajes` responde 400
- **THEN** las metricas HTTP cuentan esa solicitud con codigo 400, separada de las 201

### Requirement: Errores en Sentry
El sistema SHALL enviar a Sentry las excepciones no controladas del backend solo cuando `SENTRY_DSN` tiene valor.

#### Scenario: Excepcion no controlada en el despliegue
- **WHEN** una ruta lanza una excepcion no controlada en el despliegue con `SENTRY_DSN`
- **THEN** la respuesta es 500 y Sentry recibe el error con su stack trace, ruta y entorno

#### Scenario: Sin DSN
- **WHEN** el servidor arranca sin `SENTRY_DSN`
- **THEN** Sentry no se inicia y el chat funciona igual

### Requirement: Credenciales fuera del codigo
El token de Grafana Cloud y el DSN de Sentry MUST leerse solo de variables de entorno y MUST NOT aparecer en el codigo, en archivos versionados ni en logs.

#### Scenario: Archivo de ejemplo
- **WHEN** se revisa `.env.example`
- **THEN** las claves aparecen con valor vacio

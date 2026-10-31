// telemetria: Sentry (errores del despliegue) y OpenTelemetry (logs, metricas
// y trazas hacia Grafana Cloud, solo en local). Cada parte se activa con su
// variable de entorno; sin ellas el chat funciona igual y no exporta nada.
// Debe iniciarse antes de require('express') para que se instrumente.

var api = require('@opentelemetry/api');

var NOMBRE = 'una-chat';
var NIVELES = {
  info: api.SeverityNumber.INFO,
  warn: api.SeverityNumber.WARN,
  error: api.SeverityNumber.ERROR
};

var sdk = null;
var instrumentos = null;

// exportar solo si hay endpoint OTLP (Render no lo define)
function otelHabilitado(env) {
  return Boolean((env.OTEL_EXPORTER_OTLP_ENDPOINT || '').trim());
}

// entorno de origen: deployment.environment(.name) de OTEL_RESOURCE_ATTRIBUTES, si no "local"
function entornoDespliegue(env) {
  var pares = (env.OTEL_RESOURCE_ATTRIBUTES || '').split(',');
  for (var i = 0; i < pares.length; i++) {
    var igual = pares[i].indexOf('=');
    if (igual < 1) continue;
    var clave = pares[i].slice(0, igual).trim();
    var valor = pares[i].slice(igual + 1).trim();
    if ((clave === 'deployment.environment.name' || clave === 'deployment.environment') && valor) {
      return valor;
    }
  }
  return 'local';
}

function iniciarSentry(env) {
  if (!(env.SENTRY_DSN || '').trim()) return;
  var Sentry = require('@sentry/node');
  Sentry.init({
    dsn: env.SENTRY_DSN.trim(),
    environment: env.SENTRY_ENVIRONMENT || 'production',
    sendDefaultPii: false
  });
}

function iniciarOtel(env) {
  if (!otelHabilitado(env)) return;

  var NodeSDK = require('@opentelemetry/sdk-node').NodeSDK;
  var resourceFromAttributes = require('@opentelemetry/resources').resourceFromAttributes;
  var PeriodicExportingMetricReader = require('@opentelemetry/sdk-metrics').PeriodicExportingMetricReader;
  var BatchLogRecordProcessor = require('@opentelemetry/sdk-logs').BatchLogRecordProcessor;
  var OTLPTraceExporter = require('@opentelemetry/exporter-trace-otlp-proto').OTLPTraceExporter;
  var OTLPMetricExporter = require('@opentelemetry/exporter-metrics-otlp-proto').OTLPMetricExporter;
  var OTLPLogExporter = require('@opentelemetry/exporter-logs-otlp-proto').OTLPLogExporter;
  var HttpInstrumentation = require('@opentelemetry/instrumentation-http').HttpInstrumentation;
  var ExpressInstrumentation = require('@opentelemetry/instrumentation-express').ExpressInstrumentation;

  var entorno = entornoDespliegue(env);

  // los exportadores leen endpoint y headers de OTEL_EXPORTER_OTLP_*
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': env.OTEL_SERVICE_NAME || NOMBRE,
      'deployment.environment.name': entorno,
      'deployment.environment': entorno
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 15000
    })],
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    instrumentations: [
      new HttpInstrumentation({
        // el sondeo de Socket.IO no es una solicitud del chat
        ignoreIncomingRequestHook: function (req) {
          return (req.url || '').indexOf('/socket.io') === 0;
        }
      }),
      new ExpressInstrumentation()
    ]
  });
  sdk.start();

  // vaciar lo pendiente al detener el contenedor o el proceso
  ['SIGTERM', 'SIGINT'].forEach(function (senal) {
    process.once(senal, function () {
      sdk.shutdown().catch(function () {}).then(function () { process.exit(0); });
    });
  });
}

function iniciar(env) {
  env = env || process.env;
  iniciarSentry(env);
  iniciarOtel(env);
}

// tracer, meter y logger se piden despues de iniciar: el API de metricas no tiene proxy
function obtenerInstrumentos() {
  if (instrumentos) return instrumentos;
  var meter = api.metrics.getMeter(NOMBRE);
  instrumentos = {
    tracer: api.trace.getTracer(NOMBRE),
    logger: api.logs.getLogger(NOMBRE),
    mensajes: meter.createCounter('chat.mensajes', {
      description: 'Mensajes procesados por canal y resultado'
    }),
    duracion: meter.createHistogram('chat.mensaje.duracion', {
      description: 'Tiempo de procesamiento de un mensaje',
      unit: 's'
    })
  };
  return instrumentos;
}

// log a consola (Render) y a OpenTelemetry; dentro de un span lleva su trace_id
function registrarLog(nivel, texto, atributos) {
  console.log('[' + nivel + '] ' + texto + (atributos ? ' ' + JSON.stringify(atributos) : ''));
  obtenerInstrumentos().logger.emit({
    severityNumber: NIVELES[nivel] || NIVELES.info,
    severityText: nivel.toUpperCase(),
    body: texto,
    attributes: atributos || {}
  });
}

// registra en Sentry un error de Express (no hace nada si Sentry no se inicio)
function manejarErroresExpress(app) {
  if (!(process.env.SENTRY_DSN || '').trim()) return;
  require('@sentry/node').setupExpressErrorHandler(app);
}

module.exports = {
  iniciar: iniciar,
  otelHabilitado: otelHabilitado,
  entornoDespliegue: entornoDespliegue,
  obtenerInstrumentos: obtenerInstrumentos,
  registrarLog: registrarLog,
  manejarErroresExpress: manejarErroresExpress
};

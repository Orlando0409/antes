// npm install para descargar los paquetes...

// telemetria primero: debe instrumentar express antes de cargarlo
var telemetria = require('./libs/telemetria');
telemetria.iniciar();

// libreriuas
var api = require('@opentelemetry/api');
var validation = require('./libs/unalib');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

var EVENTO = 'Evento-Mensaje-Server';

// validateMessage no lanza: un rechazo devuelve el mensaje de "Sistema"
function esRechazado(validado) {
  var obj = JSON.parse(validado);
  return obj.nombre === 'Sistema' && (obj.mensaje === '' || obj.mensaje === 'Mensaje invalido');
}

// valida un mensaje dentro de un span, con su log y sus metricas
function procesarMensaje(msg, canal) {
  var inst = telemetria.obtenerInstrumentos();
  var inicio = process.hrtime.bigint();

  return inst.tracer.startActiveSpan('chat.procesar_mensaje', { attributes: { 'chat.canal': canal } }, function (span) {
    var resultado = 'rechazado';
    try {
      var validado = validation.validateMessage(msg);
      resultado = esRechazado(validado) ? 'rechazado' : 'aceptado';
      span.setAttribute('chat.resultado', resultado);

      if (resultado === 'rechazado') {
        span.setStatus({ code: api.SpanStatusCode.ERROR, message: 'Mensaje invalido' });
        telemetria.registrarLog('warn', 'Mensaje rechazado', { 'chat.canal': canal });
      } else {
        telemetria.registrarLog('info', 'Mensaje difundido', {
          'chat.canal': canal,
          'chat.nombre': JSON.parse(validado).nombre
        });
      }
      return validado;
    } catch (e) {
      span.recordException(e);
      span.setStatus({ code: api.SpanStatusCode.ERROR, message: e.message });
      telemetria.registrarLog('error', 'Error al procesar mensaje', { 'chat.canal': canal });
      throw e;
    } finally {
      var atributos = { 'chat.canal': canal, 'chat.resultado': resultado };
      inst.mensajes.add(1, atributos);
      inst.duracion.record(Number(process.hrtime.bigint() - inicio) / 1e9, atributos);
      span.end();
    }
  });
}

// root: presentar html
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

// envio por HTTP (Artillery y pruebas): misma validacion y difusion que el socket
app.post('/api/mensajes', express.json({ limit: '10kb' }), function(req, res){
  var cuerpo = req.body;
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      typeof cuerpo.mensaje !== 'string' || cuerpo.mensaje.trim() === '') {
    telemetria.obtenerInstrumentos().mensajes.add(1, { 'chat.canal': 'http', 'chat.resultado': 'rechazado' });
    telemetria.registrarLog('warn', 'Mensaje HTTP sin texto', { 'chat.canal': 'http' });
    return res.status(400).json({ error: 'Mensaje invalido' });
  }

  var validado = procesarMensaje(JSON.stringify(cuerpo), 'http');
  io.emit(EVENTO, validado);
  res.status(201).type('application/json').send(validado);
});

// TEMPORAL (Lab 7, parte 1.2): error controlado para Sentry. Retirar despues de la evidencia.
app.get('/debug-sentry', function(){
  throw new Error('Prueba de Sentry en UNA Chat');
});

// Sentry despues de las rutas: captura los errores no controlados
telemetria.manejarErroresExpress(app);

// escuchar una conexion por socket
io.on('connection', function(socket){
  // si se escucha "chat message"
  socket.on(EVENTO, function(msg){

    msg = procesarMensaje(msg, 'socket');
    // volvemos a emitir el mismo mensaje
    io.emit(EVENTO, msg);
  });
});

// solo escuchar el puerto si se ejecuta directamente (node server.js),
// no cuando se importa desde las pruebas de integracion
if (require.main === module) {
  http.listen(port, function(){
    console.log('listening on *:' + port);
  });
}

module.exports = { app: app, http: http, io: io };

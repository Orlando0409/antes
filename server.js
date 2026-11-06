// npm install para descargar los paquetes...

// telemetria primero: debe instrumentar express antes de cargarlo
var telemetria = require('./libs/telemetria');
telemetria.iniciar();

// libreriuas
var api = require('@opentelemetry/api');
var validation = require('./libs/unalib');
var authGate = require('./server/auth');
var vault = require('./server/vault');
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
        var datosLog = { 'chat.canal': canal };
        // con Auth0 el nombre puede ser el nombre real o el correo: no va al log
        if (!authGate.authSettings()) datosLog['chat.nombre'] = JSON.parse(validado).nombre;
        telemetria.registrarLog('info', 'Mensaje difundido', datosLog);
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

// configuracion publica: nunca lleva el secreto
app.get('/auth/config', function(req, res){
  var settings = authGate.authSettings();
  if (!settings) return res.json({ enabled: false });
  res.json({ enabled: true, domain: settings.domain, clientId: settings.clientId });
});

app.get('/auth/login', function(req, res){
  if (!authGate.authSettings()) return res.status(404).json({ error: 'Login deshabilitado' });
  authGate.beginLogin(req, res);
});

app.get('/auth/callback', function(req, res){
  if (!authGate.authSettings()) return res.redirect('/');
  authGate.finishLogin(req, res);
});

app.get('/auth/logout', function(req, res){
  authGate.logout(req, res);
});

app.get('/sala', function(req, res){
  if (!authGate.authSettings()) return res.json({ enabled: false });
  authGate.readSession(req, res);
});

// con Auth0 configurado, publicar por HTTP tambien exige sesion
function exigirSesion(req, res, next) {
  if (!authGate.authSettings()) return next();
  authGate.requireSession(req, res, next);
}

// envio por HTTP (Artillery y pruebas): misma validacion y difusion que el socket
app.post('/api/mensajes', exigirSesion, express.json({ limit: '10kb' }), function(req, res){
  var cuerpo = req.body;
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      typeof cuerpo.mensaje !== 'string' || cuerpo.mensaje.trim() === '') {
    telemetria.obtenerInstrumentos().mensajes.add(1, { 'chat.canal': 'http', 'chat.resultado': 'rechazado' });
    telemetria.registrarLog('warn', 'Mensaje HTTP sin texto', { 'chat.canal': 'http' });
    return res.status(400).json({ error: 'Mensaje invalido' });
  }

  var crudo = JSON.stringify(cuerpo);
  if (req.usuario) crudo = authGate.stampSender(crudo, req.usuario.name);
  var validado = procesarMensaje(crudo, 'http');
  io.emit(EVENTO, validado);
  res.status(201).type('application/json').send(validado);
});

// Sentry despues de las rutas: captura los errores no controlados
telemetria.manejarErroresExpress(app);

// con Auth0 configurado, el socket exige sesion
io.use(function(socket, next){
  if (!authGate.authSettings()) return next();
  authGate.authorizeSocket(socket, next);
});

// escuchar una conexion por socket
io.on('connection', function(socket){
  // si se escucha "chat message"
  socket.on(EVENTO, function(msg){
    // el remitente sale de la sesion, no del cliente
    if (socket.data && socket.data.user) msg = authGate.stampSender(msg, socket.data.user.name);

    msg = procesarMensaje(msg, 'socket');
    // volvemos a emitir el mismo mensaje
    io.emit(EVENTO, msg);
  });
});

// con Auth0 configurado: lee el secreto de Vault y lo comprueba antes de abrir el puerto
function boot() {
  if (!authGate.authSettings()) return Promise.resolve();
  if (process.env.AUTH0_CLIENT_SECRET) {
    console.warn('AUTH0_CLIENT_SECRET is set and is ignored. The client secret is loaded from Supabase Vault.');
  }
  return vault.loadAuth0ClientSecret().then(function(secret){
    return authGate.initAuth0(secret).catch(function(err){
      var message = err && err.message ? String(err.message) : '';
      if (message.indexOf('Auth0 ') === 0 && message.length < 120 && message.indexOf(secret) === -1) throw new Error(message);
      throw new Error(vault.redact(message, secret));
    });
  });
}

// solo escuchar el puerto si se ejecuta directamente (node server.js),
// no cuando se importa desde las pruebas de integracion
if (require.main === module) {
  boot().then(function(){
    http.listen(port, function(){
      console.log('listening on *:' + port);
    });
  }).catch(function(err){
    console.error(err && err.message ? err.message : 'Auth0 startup failed.');
    process.exit(1);
  });
}

module.exports = { app: app, http: http, io: io, boot: boot };

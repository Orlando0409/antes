// Pruebas unitarias BDD de server/auth (mocha + chai expect)
// Spec: openspec/changes/auth0-vault-secret/specs/inicio-sesion/spec.md
//       openspec/changes/auth0-vault-secret/specs/secreto-vault/spec.md

var expect = require('chai').expect;
var auth = require('../server/auth');
var unalib = require('../libs/unalib');

var SECRETO = 'valor-secreto-de-prueba-0123456789';
var VARIABLES = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'APP_BASE_URL', 'RENDER_EXTERNAL_URL'];


describe('Funcionalidad: comprobacion del secreto contra Auth0', function(){

  var fetchOriginal = global.fetch;
  var previas = {};
  var cuerpoEnviado;

  // Auth0 simulado: responde el error OAuth indicado
  function auth0Responde(error) {
    global.fetch = function(url, opciones){
      cuerpoEnviado = opciones.body;
      return Promise.resolve({
        json: function(){ return Promise.resolve({ error: error }); }
      });
    };
  }

  beforeEach(function(){
    VARIABLES.forEach(function(nombre){ previas[nombre] = process.env[nombre]; });
    process.env.AUTH0_DOMAIN = 'prueba.auth0.test';
    process.env.AUTH0_CLIENT_ID = 'client-id-de-prueba';
    process.env.APP_BASE_URL = 'http://localhost:3000';
  });

  afterEach(function(){
    global.fetch = fetchOriginal;
    VARIABLES.forEach(function(nombre){
      if (previas[nombre] === undefined) delete process.env[nombre];
      else process.env[nombre] = previas[nombre];
    });
  });

  context('Dado un secreto vigente', function(){
    context('Cuando Auth0 responde invalid_grant al codigo de prueba', function(){
      it('Entonces el secreto debe aceptarse', function(){
        auth0Responde('invalid_grant');
        return auth.probeClientSecret(SECRETO).then(function(){
          expect(cuerpoEnviado.get('code')).to.equal('vault-startup-probe');
          expect(cuerpoEnviado.get('client_secret')).to.equal(SECRETO);
        });
      });
    });
  });

  context('Dado un secreto rotado o de otra aplicacion', function(){
    context('Cuando Auth0 responde invalid_client', function(){
      it('Entonces debe impedir el arranque sin mostrar el secreto', function(){
        auth0Responde('invalid_client');
        return auth.probeClientSecret(SECRETO).then(function(){
          throw new Error('se esperaba un rechazo');
        }, function(err){
          expect(err.message).to.equal('Auth0 rejected the client secret.');
          expect(err.message).to.not.contain(SECRETO);
        });
      });
    });
  });

  context('Dado una respuesta inesperada de Auth0', function(){
    context('Cuando el error contiene datos sensibles', function(){
      it('Entonces debe impedir el arranque registrando solo un codigo conocido', function(){
        auth0Responde('fallo ' + SECRETO);
        return auth.probeClientSecret(SECRETO).then(function(){
          throw new Error('se esperaba un rechazo');
        }, function(err){
          expect(err.message).to.contain('unknown');
          expect(err.message).to.not.contain(SECRETO);
        });
      });
    });
  });

});


describe('Funcionalidad: errores de Auth0 sin datos sensibles', function(){

  context('Dado un error cuya descripcion contiene el secreto', function(){
    context('Cuando se calcula lo que se registra', function(){
      it('Entonces debe quedar solo el codigo conocido', function(){
        expect(auth.oauthErrorCode({
          message: 'client_secret=' + SECRETO,
          cause: { error: 'invalid_client', error_description: 'client_secret=' + SECRETO }
        })).to.equal('invalid_client');
      });
    });
  });

  context('Dado un error con un codigo desconocido', function(){
    context('Cuando se calcula lo que se registra', function(){
      it('Entonces debe registrarse unknown', function(){
        expect(auth.oauthErrorCode({ cause: { error: SECRETO } })).to.equal('unknown');
        expect(auth.oauthErrorCode({ message: 'postgres://u:p@host/db' })).to.equal('unknown');
      });
    });
  });

});


describe('Funcionalidad: remitente autenticado', function(){

  context('Dado una persona autenticada como Ana', function(){
    context('Cuando envia un mensaje con nombre Admin', function(){
      it('Entonces el mensaje difundido debe llevar el nombre Ana', function(){
        var crudo = JSON.stringify({ nombre: 'Admin', mensaje: 'hola', color: '#112233' });
        var limpio = JSON.parse(unalib.validateMessage(auth.stampSender(crudo, 'Ana')));
        expect(limpio.nombre).to.equal('Ana');
        expect(limpio.mensaje).to.contain('hola');
      });
    });

    context('Cuando emite JSON invalido', function(){
      it('Entonces el servidor debe difundir Mensaje invalido', function(){
        var limpio = JSON.parse(unalib.validateMessage(auth.stampSender('{no json', 'Ana')));
        expect(limpio.mensaje).to.equal('Mensaje invalido');
      });
    });

    context('Cuando emite un arreglo JSON', function(){
      it('Entonces el servidor debe difundir Mensaje invalido', function(){
        var limpio = JSON.parse(unalib.validateMessage(auth.stampSender('[1,2]', 'Ana')));
        expect(limpio.mensaje).to.equal('Mensaje invalido');
      });
    });
  });

  context('Dado un nombre de sesion con codigo', function(){
    context('Cuando pasa por validateMessage', function(){
      it('Entonces el nombre difundido no debe contener etiquetas', function(){
        var crudo = JSON.stringify({ nombre: 'x', mensaje: 'hola', color: '#112233' });
        var limpio = JSON.parse(unalib.validateMessage(auth.stampSender(crudo, '<script>alert(1)</script>Ana')));
        expect(limpio.nombre).to.equal('Ana');
      });
    });
  });

});


describe('Funcionalidad: URL base de la aplicacion', function(){

  var previa;

  beforeEach(function(){
    previa = [process.env.APP_BASE_URL, process.env.RENDER_EXTERNAL_URL];
    delete process.env.RENDER_EXTERNAL_URL;
  });

  afterEach(function(){
    if (previa[0] === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previa[0];
    if (previa[1] !== undefined) process.env.RENDER_EXTERNAL_URL = previa[1];
  });

  context('Dado una URL local http o publica https', function(){
    context('Cuando se calcula la base', function(){
      it('Entonces debe aceptarse sin barra final', function(){
        process.env.APP_BASE_URL = 'http://localhost:3000/';
        expect(auth.appBaseUrl()).to.equal('http://localhost:3000');
        process.env.APP_BASE_URL = 'https://una-chat.onrender.com';
        expect(auth.appBaseUrl()).to.equal('https://una-chat.onrender.com');
      });
    });
  });

  context('Dado una URL publica http o con credenciales', function(){
    context('Cuando se calcula la base', function(){
      it('Entonces debe rechazarse', function(){
        process.env.APP_BASE_URL = 'http://malo.example';
        expect(auth.appBaseUrl()).to.equal('');
        process.env.APP_BASE_URL = 'https://user:secret@una-chat.onrender.com';
        expect(auth.appBaseUrl()).to.equal('');
      });
    });
  });

});


describe('Funcionalidad: URLs de Auth0 con la libreria real', function(){

  var fetchOriginal = global.fetch;
  var previas = {};
  var EMISOR = 'https://prueba.auth0.test/';

  beforeEach(function(){
    VARIABLES.forEach(function(nombre){ previas[nombre] = process.env[nombre]; });
    process.env.AUTH0_DOMAIN = 'prueba.auth0.test';
    process.env.AUTH0_CLIENT_ID = 'client-id-de-prueba';
    process.env.APP_BASE_URL = 'https://una-chat.example';
    delete process.env.RENDER_EXTERNAL_URL;

    // Auth0 simulado: discovery y token
    global.fetch = function(destino){
      var cuerpo = String(destino.href || destino).indexOf('/oauth/token') !== -1
        ? { error: 'invalid_grant' }
        : {
          issuer: EMISOR,
          authorization_endpoint: EMISOR + 'authorize',
          token_endpoint: EMISOR + 'oauth/token',
          jwks_uri: EMISOR + '.well-known/jwks.json',
          end_session_endpoint: EMISOR + 'oidc/logout'
        };
      return Promise.resolve(new Response(JSON.stringify(cuerpo), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));
    };
    return auth.initAuth0(SECRETO);
  });

  afterEach(function(){
    global.fetch = fetchOriginal;
    VARIABLES.forEach(function(nombre){
      if (previas[nombre] === undefined) delete process.env[nombre];
      else process.env[nombre] = previas[nombre];
    });
  });

  // respuesta minima: resuelve cuando la ruta redirige
  function respuesta(resolver) {
    var res = {
      cookies: {},
      cookie: function(nombre, valor, opciones){ res.cookies[nombre] = { valor: valor, opciones: opciones }; },
      clearCookie: function(){},
      redirect: function(destino){ resolver({ destino: destino, cookies: res.cookies }); },
      status: function(codigo){ res.codigo = codigo; return res; },
      type: function(){ return res; },
      send: function(texto){ resolver({ error: res.codigo + ' ' + texto }); }
    };
    return res;
  }

  context('Dado un visitante que pide iniciar sesion', function(){
    context('Cuando se arma la redireccion', function(){
      it('Entonces debe ir a Auth0 con PKCE, state y nonce, sin el secreto', function(){
        return new Promise(function(resolve){
          auth.beginLogin({}, respuesta(resolve));
        }).then(function(r){
          expect(r.error).to.be.undefined;
          var destino = new URL(r.destino);
          expect(destino.origin + destino.pathname).to.equal(EMISOR + 'authorize');
          expect(destino.searchParams.get('code_challenge_method')).to.equal('S256');
          expect(destino.searchParams.get('code_challenge')).to.be.a('string').and.not.empty;
          expect(destino.searchParams.get('redirect_uri')).to.equal('https://una-chat.example/auth/callback');
          expect(r.destino).to.not.contain(SECRETO);

          // la transaccion guarda el mismo state y nonce que viajan a Auth0
          var sellada = r.cookies.una_chat_oauth;
          var txn = JSON.parse(Buffer.from(sellada.valor.split('.')[0], 'base64url').toString('utf8'));
          expect(txn.state).to.equal(destino.searchParams.get('state'));
          expect(txn.nonce).to.equal(destino.searchParams.get('nonce'));
          expect(sellada.opciones.httpOnly).to.be.true;
          expect(sellada.opciones.secure).to.be.true;
          expect(sellada.valor).to.not.contain(SECRETO);
        });
      });
    });
  });

  context('Dado una persona que cierra sesion', function(){
    context('Cuando se arma la redireccion', function(){
      it('Entonces debe ir a Auth0 y volver a la aplicacion', function(){
        return new Promise(function(resolve){
          auth.logout({}, respuesta(resolve));
        }).then(function(r){
          expect(r.destino.indexOf(EMISOR)).to.equal(0);
          expect(r.destino).to.contain(encodeURIComponent('https://una-chat.example/'));
          expect(r.destino).to.not.contain(SECRETO);
        });
      });
    });
  });

});

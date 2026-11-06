// Pruebas unitarias BDD de libs/telemetria (mocha + chai expect)
// Spec: openspec/changes/monitoreo-telemetria/specs/monitoreo/spec.md

var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');
var telemetria = require('../libs/telemetria');


describe('Funcionalidad: exportacion solo con endpoint configurado', function(){

  context('Dado un despliegue sin OTEL_EXPORTER_OTLP_ENDPOINT', function(){
    context('Cuando se evalua si se exporta', function(){
      it('Entonces la exportacion debe quedar deshabilitada', function(){
        expect(telemetria.otelHabilitado({})).to.be.false;
        expect(telemetria.otelHabilitado({ OTEL_EXPORTER_OTLP_ENDPOINT: '   ' })).to.be.false;
      });
    });
  });

  context('Dado un equipo local con OTEL_EXPORTER_OTLP_ENDPOINT', function(){
    context('Cuando se evalua si se exporta', function(){
      it('Entonces la exportacion debe quedar habilitada', function(){
        var env = { OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otlp-gateway-prod-us-east-0.grafana.net/otlp' };
        expect(telemetria.otelHabilitado(env)).to.be.true;
      });
    });
  });

});


describe('Funcionalidad: entorno de origen identificado', function(){

  context('Dado que OTEL_RESOURCE_ATTRIBUTES no define el entorno', function(){
    context('Cuando se calcula el entorno', function(){
      it('Entonces debe ser local', function(){
        expect(telemetria.entornoDespliegue({})).to.equal('local');
        expect(telemetria.entornoDespliegue({ OTEL_RESOURCE_ATTRIBUTES: 'team=una' })).to.equal('local');
      });
    });
  });

  context('Dado que OTEL_RESOURCE_ATTRIBUTES define el entorno', function(){
    context('Cuando se usa deployment.environment.name', function(){
      it('Entonces debe devolver ese valor', function(){
        var env = { OTEL_RESOURCE_ATTRIBUTES: 'team=una, deployment.environment.name=docker-local' };
        expect(telemetria.entornoDespliegue(env)).to.equal('docker-local');
      });
    });

    context('Cuando se usa la clave anterior deployment.environment', function(){
      it('Entonces tambien debe devolver ese valor', function(){
        var env = { OTEL_RESOURCE_ATTRIBUTES: 'deployment.environment=local' };
        expect(telemetria.entornoDespliegue(env)).to.equal('local');
      });
    });
  });

});


describe('Funcionalidad: errores en Sentry', function(){

  context('Dado un servidor sin SENTRY_DSN', function(){
    context('Cuando se inicia la telemetria', function(){
      it('Entonces Sentry no debe cargarse', function(){
        telemetria.iniciar({});
        expect(require.cache[require.resolve('@sentry/node')]).to.be.undefined;
      });
    });
  });

});


describe('Funcionalidad: credenciales fuera del codigo', function(){

  context('Dado el archivo .env.example versionado', function(){
    context('Cuando se revisan sus claves', function(){
      it('Entonces todas deben tener valor vacio', function(){
        var texto = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
        var lineas = texto.split(/\r?\n/).filter(function(l){ return /^[A-Z_]+=/.test(l); });

        expect(lineas).to.not.be.empty;
        lineas.forEach(function(l){
          expect(l, l).to.match(/^[A-Z_]+=$/);
        });
      });
    });
  });

});


describe('Funcionalidad: secreto fuera del alcance del cliente', function(){

  context('Dado una solicitud a /auth/callback', function(){
    context('Cuando la instrumentacion HTTP la evalua', function(){
      it('Entonces debe ignorarse para no exportar code ni state', function(){
        expect(telemetria.ignorarSolicitud({ url: '/auth/callback?code=abc&state=def' })).to.be.true;
        expect(telemetria.ignorarSolicitud({ url: '/socket.io/?EIO=4' })).to.be.true;
        expect(telemetria.ignorarSolicitud({ url: '/api/mensajes' })).to.be.false;
      });
    });
  });

  context('Dado un evento de Sentry del callback', function(){
    context('Cuando se limpia antes de enviarlo', function(){
      it('Entonces no debe llevar el codigo ni la cookie de sesion', function(){
        var limpio = telemetria.limpiarEventoSentry({
          request: {
            url: 'https://una.example/auth/callback?code=abc',
            query_string: 'code=abc',
            cookies: { una_chat_id_token: 'token' },
            headers: { cookie: 'una_chat_id_token=token', accept: 'text/html' }
          }
        });
        expect(limpio.request.url).to.equal('https://una.example/auth/callback');
        expect(limpio.request.query_string).to.be.undefined;
        expect(limpio.request.cookies).to.be.undefined;
        expect(limpio.request.headers).to.deep.equal({ accept: 'text/html' });
      });
    });
  });

  context('Dado un evento de Sentry de otra ruta', function(){
    context('Cuando se limpia antes de enviarlo', function(){
      it('Entonces debe conservar su ruta', function(){
        var limpio = telemetria.limpiarEventoSentry({ request: { url: 'https://una.example/api/mensajes?x=1' } });
        expect(limpio.request.url).to.equal('https://una.example/api/mensajes?x=1');
      });
    });
  });

});

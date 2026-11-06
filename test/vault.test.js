// Pruebas unitarias BDD de server/vault (mocha + chai expect)
// Spec: openspec/changes/auth0-vault-secret/specs/secreto-vault/spec.md

var expect = require('chai').expect;
var vault = require('../server/vault');

var URI = 'postgres://una_chat_backend:password@db.example.supabase.co:5432/postgres';
var SECRETO = 'valor-secreto-de-prueba-0123456789';

// la promesa debe fallar; devuelve el error para revisarlo
function debeFallar(promesa) {
  return promesa.then(function(){
    throw new Error('se esperaba un fallo');
  }, function(err){
    return err;
  });
}

// consulta inyectada que falla con un codigo de Postgres
function consultaConError(codigo, texto) {
  return function(){
    var err = new Error(texto || 'fallo');
    err.code = codigo;
    throw err;
  };
}


describe('Funcionalidad: fallo cerrado al leer Vault', function(){

  context('Dado que falta VAULT_DATABASE_URL', function(){
    context('Cuando se pide el secreto', function(){
      it('Entonces debe fallar nombrando la variable', function(){
        return debeFallar(vault.loadAuth0ClientSecret({ connectionString: '' })).then(function(err){
          expect(err.message).to.contain('VAULT_DATABASE_URL');
        });
      });
    });
  });

  context('Dado una conexion que no es Postgres', function(){
    context('Cuando se pide el secreto', function(){
      it('Entonces debe fallar con el mensaje de conexion invalida', function(){
        return debeFallar(vault.loadAuth0ClientSecret({ connectionString: 'https://example.test' })).then(function(err){
          expect(err.message).to.equal(vault.SAFE_MESSAGES.badUrl);
        });
      });
    });
  });

  context('Dado un rol sin permiso', function(){
    context('Cuando Postgres responde 42501', function(){
      it('Entonces el mensaje debe indicar que el rol no puede ejecutar la funcion', function(){
        return debeFallar(vault.loadAuth0ClientSecret({
          connectionString: URI,
          query: consultaConError('42501', 'permission denied for function')
        })).then(function(err){
          expect(err.message).to.equal(vault.SAFE_MESSAGES.denied);
        });
      });
    });
  });

  context('Dado un secreto ausente o demasiado corto', function(){
    [[], [{ secret: null }], [{ secret: 'corto' }]].forEach(function(filas){
      context('Cuando Vault devuelve ' + JSON.stringify(filas), function(){
        it('Entonces el mensaje debe nombrar una_chat_auth0_client_secret', function(){
          return debeFallar(vault.loadAuth0ClientSecret({
            connectionString: URI,
            query: function(){ return Promise.resolve({ rows: filas }); }
          })).then(function(err){
            expect(err.message).to.contain('una_chat_auth0_client_secret');
          });
        });
      });
    });
  });

  context('Dado un error de base con datos sensibles', function(){
    context('Cuando el error contiene el secreto y la URI', function(){
      it('Entonces el mensaje debe ser generico y no contenerlos', function(){
        return debeFallar(vault.loadAuth0ClientSecret({
          connectionString: URI,
          query: consultaConError('XX000', 'fallo cerca de ' + SECRETO + ' ' + URI)
        })).then(function(err){
          expect(err.message).to.equal(vault.SAFE_MESSAGES.generic);
          expect(err.message).to.not.contain(SECRETO);
          expect(err.message).to.not.contain('postgres://');
        });
      });
    });

    context('Cuando se limpia un texto que contiene el secreto', function(){
      it('Entonces redact debe devolver el mensaje generico', function(){
        expect(vault.redact('fallo con ' + SECRETO, SECRETO)).to.equal(vault.SAFE_MESSAGES.generic);
        expect(vault.redact('fallo en ' + URI, SECRETO)).to.equal(vault.SAFE_MESSAGES.generic);
      });
    });
  });

});


describe('Funcionalidad: conexion a Vault con TLS verificado', function(){

  context('Dado un certificado que no se puede verificar', function(){
    context('Cuando la conexion falla', function(){
      it('Entonces debe describirse como error de certificado', function(){
        expect(vault.describeVaultFailure({ code: 'UNABLE_TO_GET_ISSUER_CERT' })).to.equal(vault.SAFE_MESSAGES.certificate);
        expect(vault.describeVaultFailure({ code: 'SELF_SIGNED_CERT_IN_CHAIN' })).to.equal(vault.SAFE_MESSAGES.certificate);
      });
    });
  });

  context('Dado una conexion con sslmode que desactiva la verificacion', function(){
    context('Cuando se arma la configuracion', function(){
      it('Entonces debe verificar el certificado de todos modos', function(){
        var config = vault.clientConfig(URI + '?sslmode=no-verify');
        expect(config.ssl.rejectUnauthorized).to.be.true;
        expect(config.ssl.ca.join('\n')).to.contain('BEGIN CERTIFICATE');
      });
    });
  });

  context('Dado un host inalcanzable', function(){
    context('Cuando la conexion falla', function(){
      it('Entonces debe describirse como Vault inalcanzable', function(){
        expect(vault.describeVaultFailure({ code: 'ENETUNREACH' })).to.equal(vault.SAFE_MESSAGES.unreachable);
      });
    });
  });

});


describe('Funcionalidad: secreto leido de Vault', function(){

  context('Dado que Vault entrega un secreto valido', function(){
    context('Cuando se pide el secreto', function(){
      it('Entonces debe devolverlo a quien lo pidio', function(){
        return vault.loadAuth0ClientSecret({
          connectionString: URI,
          query: function(){ return Promise.resolve({ rows: [{ secret: SECRETO }] }); }
        }).then(function(secreto){
          expect(secreto).to.equal(SECRETO);
        });
      });
    });
  });

});


describe('Funcionalidad: scripts de permisos sin valores sensibles', function(){

  var fs = require('fs');
  var path = require('path');
  var raiz = path.join(__dirname, '..');

  context('Dado el archivo .env.example', function(){
    context('Cuando se revisa', function(){
      it('Entonces VAULT_DATABASE_URL debe estar vacia y no debe existir AUTH0_CLIENT_SECRET', function(){
        var ejemplo = fs.readFileSync(path.join(raiz, '.env.example'), 'utf8');
        expect(ejemplo).to.match(/^VAULT_DATABASE_URL=\s*$/m);
        expect(ejemplo).to.not.match(/^AUTH0_CLIENT_SECRET=/m);
      });
    });
  });

  context('Dado el script de privilegios', function(){
    context('Cuando se revisa', function(){
      it('Entonces no debe seleccionar el valor del secreto', function(){
        var sql = fs.readFileSync(path.join(raiz, 'sql', 'check_vault_privileges.sql'), 'utf8');
        expect(sql.replace(/^--.*$/gm, '')).to.not.match(/\bdecrypted_secret\b/);
      });
    });
  });

});

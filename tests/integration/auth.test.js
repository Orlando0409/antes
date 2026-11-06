// Pruebas de integracion del login con Auth0 activo por entorno. No usan red:
// Auth0 se simula con fetch y https.get, y los tokens se firman con una clave local.
// Spec: openspec/changes/auth0-vault-secret/specs/

const crypto = require('crypto');
const https = require('https');
const { EventEmitter } = require('events');
const { Readable } = require('stream');
const request = require('supertest');
const ioClient = require('socket.io-client');

const DOMINIO = 'prueba.auth0.test';
const CLIENT_ID = 'client-id-de-prueba';
const SECRETO = 'valor-secreto-de-prueba-0123456789';
const EMISOR = 'https://' + DOMINIO + '/';
const EVENTO = 'Evento-Mensaje-Server';
const COOKIE = 'una_chat_id_token';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const otraClave = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: 'clave-1', use: 'sig', alg: 'RS256' };

const METADATA = {
  issuer: EMISOR,
  authorization_endpoint: EMISOR + 'authorize',
  token_endpoint: EMISOR + 'oauth/token',
  jwks_uri: EMISOR + '.well-known/jwks.json',
  end_session_endpoint: EMISOR + 'oidc/logout',
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256']
};

function base64url(valor) {
  return Buffer.from(JSON.stringify(valor)).toString('base64url');
}

function firmarToken(reclamos, opciones = {}) {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = base64url({ alg: 'RS256', typ: 'JWT', kid: 'clave-1' }) + '.' + base64url({
    iss: EMISOR, aud: CLIENT_ID, sub: 'auth0|ana', iat: ahora, exp: ahora + 3600, name: 'Ana', ...reclamos
  });
  const firma = crypto.sign('RSA-SHA256', Buffer.from(cuerpo), opciones.clave || privateKey).toString('base64url');
  return cuerpo + '.' + firma;
}

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json' }
  });
}

// la libreria de JWT usa https.get: se le entrega discovery y JWKS sin red.
// Debe instalarse antes de que server/auth cargue la libreria
jest.spyOn(https, 'get').mockImplementation((url) => {
  const req = new EventEmitter();
  req.destroy = () => {};
  req.setTimeout = () => req;
  const href = String(url.href || url);
  const datos = href.indexOf('jwks.json') !== -1 ? { keys: [JWK] } : METADATA;
  setImmediate(() => {
    const res = Readable.from([Buffer.from(JSON.stringify(datos))]);
    res.statusCode = 200;
    res.headers = { 'content-type': 'application/json' };
    req.emit('response', res);
  });
  return req;
});

// jest no carga el ESM de openid-client: aqui se simula, y test/auth.test.js
// prueba estas URLs con la libreria real
jest.mock('@auth0/auth0-auth-js', () => ({
  AuthClient: class {
    async buildAuthorizationUrl({ authorizationParams }) {
      const url = new URL('https://prueba.auth0.test/authorize');
      Object.entries(authorizationParams).forEach(([k, val]) => url.searchParams.set(k, val));
      url.searchParams.set('code_challenge', 'reto');
      url.searchParams.set('code_challenge_method', 'S256');
      return { authorizationUrl: url, codeVerifier: 'verificador' };
    }
    async buildLogoutUrl({ returnTo }) {
      return new URL('https://prueba.auth0.test/oidc/logout?post_logout_redirect_uri=' + encodeURIComponent(returnTo));
    }
  }
}));

let auth;
let vault;
let boot;
let app;
let http;
let io;
let url;
let tokenEndpoint;
let cuerpoCanje;
const fetchOriginal = global.fetch;

function cookieDe(res, nombre) {
  return (res.headers['set-cookie'] || []).find((c) => c.indexOf(nombre + '=') === 0) || '';
}

function conectar(cookie) {
  return ioClient(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: cookie ? { cookie } : {}
  });
}

function esperarConexion(cliente) {
  return new Promise((resolve) => {
    cliente.once('connect', () => resolve('conectado'));
    cliente.once('connect_error', (err) => resolve(err));
  });
}

beforeAll(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  process.env.AUTH0_DOMAIN = DOMINIO;
  process.env.AUTH0_CLIENT_ID = CLIENT_ID;
  process.env.APP_BASE_URL = 'https://una-chat.example';

  tokenEndpoint = () => respuestaJson({ error: 'invalid_grant' }, 403);
  global.fetch = async (destino, opciones) => {
    const href = String(destino.href || destino);
    if (href.indexOf('/oauth/token') !== -1) {
      cuerpoCanje = opciones.body;
      return tokenEndpoint();
    }
    if (href.indexOf('.well-known') !== -1) return respuestaJson(METADATA);
    throw new Error('Solicitud inesperada: ' + href);
  };

  auth = require('../../server/auth');
  vault = require('../../server/vault');
  ({ app, http, io, boot } = require('../../server'));

  jest.spyOn(vault, 'loadAuth0ClientSecret').mockResolvedValue(SECRETO);
  await boot();

  await new Promise((resolve) => http.listen(0, resolve));
  url = 'http://localhost:' + http.address().port;
});

afterAll((done) => {
  global.fetch = fetchOriginal;
  ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'APP_BASE_URL'].forEach((n) => delete process.env[n]);
  jest.restoreAllMocks();
  io.close(() => done());
});


describe('Funcionalidad: arranque con Vault', () => {

  test('Dado AUTH0_CLIENT_SECRET definida, usa Vault y avisa sin mostrar el valor', async () => {
    const valorAnterior = 'valor-anterior-que-no-debe-verse';
    process.env.AUTH0_CLIENT_SECRET = valorAnterior;
    console.warn.mockClear();
    await boot();
    delete process.env.AUTH0_CLIENT_SECRET;

    const avisos = console.warn.mock.calls.flat().join(' ');
    expect(avisos).toContain('AUTH0_CLIENT_SECRET');
    expect(avisos).not.toContain(valorAnterior);
    expect(cuerpoCanje.get('client_secret')).toBe(SECRETO);
  });

  test('Dado un secreto rotado, el arranque falla sin mostrarlo', async () => {
    const previo = tokenEndpoint;
    tokenEndpoint = () => respuestaJson({ error: 'invalid_client' }, 401);
    await expect(boot()).rejects.toThrow('Auth0 rejected the client secret.');
    tokenEndpoint = previo;
  });

  test('Dado un APP_BASE_URL invalido, el error lo nombra', async () => {
    const previa = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = 'http://malo.example';
    await expect(boot()).rejects.toThrow('APP_BASE_URL');
    process.env.APP_BASE_URL = previa;
  });

});


describe('Funcionalidad: configuracion publica', () => {

  test('GET /auth/config responde el dominio y el Client ID sin el secreto', async () => {
    const res = await request(app).get('/auth/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true, domain: DOMINIO, clientId: CLIENT_ID });
    expect(JSON.stringify(res.body)).not.toContain(SECRETO);
  });

});


describe('Funcionalidad: inicio de sesion con Auth0', () => {

  test('GET /auth/login redirige a Auth0 con PKCE, state y nonce, y cookie protegida', async () => {
    const res = await request(app).get('/auth/login');

    expect(res.status).toBe(302);
    const destino = new URL(res.headers.location);
    expect(destino.origin + destino.pathname).toBe(EMISOR + 'authorize');
    expect(destino.searchParams.get('code_challenge')).toBeTruthy();
    expect(destino.searchParams.get('code_challenge_method')).toBe('S256');
    expect(destino.searchParams.get('state')).toBeTruthy();
    expect(destino.searchParams.get('nonce')).toBeTruthy();
    expect(res.headers.location).not.toContain(SECRETO);

    const cookie = cookieDe(res, 'una_chat_oauth');
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).not.toContain(SECRETO);
  });

  // pasa por /auth/login para obtener state, nonce y cookie de transaccion reales
  async function iniciar() {
    const res = await request(app).get('/auth/login');
    const destino = new URL(res.headers.location);
    return {
      state: destino.searchParams.get('state'),
      nonce: destino.searchParams.get('nonce'),
      cookie: cookieDe(res, 'una_chat_oauth').split(';')[0]
    };
  }

  test('state que no coincide: no canjea el codigo ni crea sesion', async () => {
    const txn = await iniciar();
    cuerpoCanje = null;
    const res = await request(app).get('/auth/callback?code=abc&state=otro').set('Cookie', txn.cookie);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/?error=state');
    expect(cuerpoCanje).toBeNull();
    expect(cookieDe(res, COOKIE)).toBe('');
  });

  test('cookie de transaccion alterada: no canjea el codigo', async () => {
    const txn = await iniciar();
    cuerpoCanje = null;
    const res = await request(app).get('/auth/callback?code=abc&state=' + encodeURIComponent(txn.state))
      .set('Cookie', 'una_chat_oauth=alterada.firma');

    expect(res.headers.location).toBe('/?error=state');
    expect(cuerpoCanje).toBeNull();
  });

  test('inicio cancelado: redirige con access_denied y sin sesion', async () => {
    const res = await request(app).get('/auth/callback?error=access_denied');
    expect(res.headers.location).toBe('/?error=access_denied');
    expect(cookieDe(res, COOKIE)).toBe('');
  });

  test('canje rechazado: sin sesion y el log solo lleva el codigo conocido', async () => {
    const txn = await iniciar();
    const previo = tokenEndpoint;
    tokenEndpoint = () => respuestaJson({ error: 'invalid_client', error_description: 'detalle ' + SECRETO }, 401);
    console.error.mockClear();

    const res = await request(app).get('/auth/callback?code=abc&state=' + encodeURIComponent(txn.state)).set('Cookie', txn.cookie);
    tokenEndpoint = previo;

    expect(res.headers.location).toBe('/?error=login_failed');
    expect(cookieDe(res, COOKIE)).toBe('');
    const logs = console.error.mock.calls.flat().join(' ');
    expect(logs).toContain('invalid_client');
    expect(logs).not.toContain(SECRETO);
  });

  test('nonce incorrecto: rechaza el ID token', async () => {
    const txn = await iniciar();
    const previo = tokenEndpoint;
    tokenEndpoint = () => respuestaJson({ id_token: firmarToken({ nonce: 'otro' }) });

    const res = await request(app).get('/auth/callback?code=abc&state=' + encodeURIComponent(txn.state)).set('Cookie', txn.cookie);
    tokenEndpoint = previo;

    expect(res.headers.location).toBe('/?error=login_failed');
    expect(cookieDe(res, COOKIE)).toBe('');
  });

  test('flujo completo: canjea con Client Secret Post y PKCE y crea la sesion', async () => {
    const txn = await iniciar();
    const previo = tokenEndpoint;
    tokenEndpoint = () => respuestaJson({ id_token: firmarToken({ nonce: txn.nonce }) });

    const res = await request(app).get('/auth/callback?code=abc&state=' + encodeURIComponent(txn.state)).set('Cookie', txn.cookie);
    tokenEndpoint = previo;

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    expect(cuerpoCanje.get('client_secret')).toBe(SECRETO);
    expect(cuerpoCanje.get('code_verifier')).toBeTruthy();

    const cookie = cookieDe(res, COOKIE);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Secure/);

    const sala = await request(app).get('/sala').set('Cookie', cookie.split(';')[0]);
    expect(sala.status).toBe(200);
    expect(sala.body).toEqual({ name: 'Ana' });
  });

});


describe('Funcionalidad: sala protegida', () => {

  test('sin cookie responde 401', async () => {
    const res = await request(app).get('/sala');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/iniciar sesi/);
  });

  test.each([
    ['falso', () => 'token.falso.x'],
    ['firmado con otra clave', () => firmarToken({}, { clave: otraClave })],
    ['vencido', () => firmarToken({ exp: Math.floor(Date.now() / 1000) - 7200 })],
    ['de otra audiencia', () => firmarToken({ aud: 'otra-aplicacion' })],
    ['de otro emisor', () => firmarToken({ iss: 'https://malo.example/' })]
  ])('token %s responde 401', async (_nombre, token) => {
    const res = await request(app).get('/sala').set('Cookie', COOKIE + '=' + token());
    expect(res.status).toBe(401);
  });

  test('token valido responde 200 con el nombre', async () => {
    const res = await request(app).get('/sala').set('Cookie', COOKIE + '=' + firmarToken({}));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Ana' });
  });

});


describe('Funcionalidad: mensajes solo con sesion', () => {

  let observador;

  beforeAll(async () => {
    observador = conectar(COOKIE + '=' + firmarToken({ name: 'Observador' }));
    expect(await esperarConexion(observador)).toBe('conectado');
  });

  afterAll(() => observador.disconnect());

  function esperarDifusion(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        observador.off(EVENTO, alRecibir);
        resolve(null);
      }, ms);
      function alRecibir(r) {
        clearTimeout(timer);
        resolve(JSON.parse(r));
      }
      observador.once(EVENTO, alRecibir);
    });
  }

  test('socket sin sesion: la conexion se rechaza', async () => {
    const cliente = conectar();
    const resultado = await esperarConexion(cliente);
    cliente.disconnect();
    expect(resultado).toBeInstanceOf(Error);
  });

  test('socket con token falso: la conexion se rechaza', async () => {
    const cliente = conectar(COOKIE + '=token.falso.x');
    const resultado = await esperarConexion(cliente);
    cliente.disconnect();
    expect(resultado).toBeInstanceOf(Error);
  });

  test('HTTP sin sesion: responde 401 y no difunde', async () => {
    const difundido = esperarDifusion(300);
    const res = await request(app).post('/api/mensajes').send({ nombre: 'Ana', mensaje: 'hola', color: '#112233' });
    expect(res.status).toBe(401);
    expect(await difundido).toBeNull();
  });

  test('HTTP con token falso: responde 401 y no difunde', async () => {
    const difundido = esperarDifusion(300);
    const res = await request(app).post('/api/mensajes').set('Cookie', COOKIE + '=token.falso.x')
      .send({ nombre: 'Ana', mensaje: 'hola', color: '#112233' });
    expect(res.status).toBe(401);
    expect(await difundido).toBeNull();
  });

  test('HTTP con sesion: el nombre sale de la sesion', async () => {
    const difundido = esperarDifusion(3000);
    const res = await request(app).post('/api/mensajes').set('Cookie', COOKIE + '=' + firmarToken({}))
      .send({ nombre: 'Admin', mensaje: 'hola', color: '#112233' });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Ana');
    expect((await difundido).nombre).toBe('Ana');
  });

  test('socket con sesion: ignora el nombre enviado y sanea el de Auth0', async () => {
    const cliente = conectar(COOKIE + '=' + firmarToken({ name: '<script>alert(1)</script>Ana' }));
    expect(await esperarConexion(cliente)).toBe('conectado');

    const difundido = esperarDifusion(3000);
    cliente.emit(EVENTO, JSON.stringify({ nombre: 'Admin', mensaje: 'hola', color: '#112233' }));
    const mensaje = await difundido;
    cliente.disconnect();

    expect(mensaje.nombre).toBe('Ana');
  });

  test('con sesion, el log del mensaje no incluye el nombre', async () => {
    console.log.mockClear();
    const res = await request(app).post('/api/mensajes').set('Cookie', COOKIE + '=' + firmarToken({ name: 'Ana Real' }))
      .send({ mensaje: 'hola', color: '#112233' });
    expect(res.status).toBe(201);

    const logs = console.log.mock.calls.flat().join(' ');
    expect(logs).toContain('Mensaje difundido');
    expect(logs).not.toContain('chat.nombre');
    expect(logs).not.toContain('Ana Real');
  });

});


describe('Funcionalidad: cierre de sesion', () => {

  test('GET /auth/logout borra la cookie y redirige a Auth0', async () => {
    const res = await request(app).get('/auth/logout').set('Cookie', COOKIE + '=' + firmarToken({}));
    expect(res.status).toBe(302);
    expect(res.headers.location.indexOf(EMISOR)).toBe(0);
    expect(cookieDe(res, COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

});


describe('Funcionalidad: secreto fuera del cliente', () => {

  test('la pagina no contiene el secreto', async () => {
    const res = await request(app).get('/');
    expect(res.text).not.toContain(SECRETO);
    expect(auth.isReady()).toBe(true);
  });

});

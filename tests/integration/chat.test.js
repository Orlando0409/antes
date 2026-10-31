// Pruebas de integracion: backend Node.js (Express + Socket.IO) + una-lib
// Ejecutar: npx jest tests/integration --runInBand --env=node

const request = require('supertest');
const ioClient = require('socket.io-client');

const unalib = require('../../libs/unalib');
const { app, http, io } = require('../../server');

const EVENTO = 'Evento-Mensaje-Server';

let url;
let cliente;
let spyValidar;

// envia un mensaje por el evento real de Socket.IO y espera la respuesta del servidor
function enviarMensaje(datos) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El servidor no respondio')), 3000);
    cliente.once(EVENTO, (respuesta) => {
      clearTimeout(timer);
      resolve(JSON.parse(respuesta));
    });
    cliente.emit(EVENTO, JSON.stringify(datos));
  });
}

beforeAll((done) => {
  // silencia los console.log de una-lib ("Es una imagen!", etc.)
  jest.spyOn(console, 'log').mockImplementation(() => {});

  // puerto 0 = puerto libre aleatorio
  http.listen(0, () => {
    url = 'http://localhost:' + http.address().port;
    cliente = ioClient(url, { transports: ['websocket'], forceNew: true });
    cliente.on('connect', done);
    cliente.on('connect_error', done);
  });
});

beforeEach(() => {
  spyValidar = jest.spyOn(unalib, 'validateMessage');
});

afterEach(() => {
  spyValidar.mockRestore();
});

afterAll((done) => {
  // cerrar cliente, Socket.IO y servidor HTTP
  if (cliente) cliente.disconnect();
  console.log.mockRestore();
  io.close(() => done());
});


describe('HTTP GET / (Supertest)', () => {

  test('responde 200 y entrega la pagina del chat', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Chat Socket.IO UNA');
    expect(res.text).toContain('Evento-Mensaje-Server');
  });

  test('ruta inexistente responde 404', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
  });

});


describe('Socket.IO evento ' + EVENTO, () => {

  test('el backend llama realmente a validateMessage de una-lib', async () => {
    const datos = { nombre: 'Ana', mensaje: 'hola', color: '#112233' };
    const res = await enviarMensaje(datos);

    expect(spyValidar).toHaveBeenCalledTimes(1);
    expect(spyValidar).toHaveBeenCalledWith(JSON.stringify(datos));
    // lo emitido es exactamente lo que devolvio validateMessage
    expect(res).toEqual(JSON.parse(spyValidar.mock.results[0].value));
    expect(res).toEqual({ nombre: 'Ana', mensaje: 'hola', color: '#112233' });
  });

  test('URL de imagen valida: el backend acepta el mensaje y devuelve <img>', async () => {
    const urlImg = 'https://www.cafedelescritor.com/wp-content/uploads/mejores-imagenes-gratis.jpg';
    const res = await enviarMensaje({ nombre: 'Ana', mensaje: urlImg, color: '#112233' });

    expect(spyValidar).toHaveBeenCalledTimes(1);
    expect(res.mensaje).toBe('<img src="' + urlImg + '" style="max-height: 400px;max-width: 400px;">');
    expect(res.nombre).toBe('Ana');
  });

  test('URL de video valida (mp4): el backend acepta el mensaje y devuelve <video>', async () => {
    const res = await enviarMensaje({ nombre: 'Ana', mensaje: 'https://videos.com/clip.mp4', color: '#112233' });

    expect(spyValidar).toHaveBeenCalledTimes(1);
    expect(res.mensaje).toMatch(/^<video src="https:\/\/videos\.com\/clip\.mp4" controls/);
  });

  test('URL de video valida (YouTube): el backend acepta el mensaje y devuelve iframe embed', async () => {
    const res = await enviarMensaje({ nombre: 'Ana', mensaje: 'https://www.youtube.com/watch?v=sgZjbk9eH6g', color: '#112233' });

    expect(spyValidar).toHaveBeenCalledTimes(1);
    expect(res.mensaje).toMatch(/^<iframe /);
    expect(res.mensaje).toContain('src="https://www.youtube.com/embed/sgZjbk9eH6g"');
  });

  test('URL no permitida: se devuelve contenido saneado', async () => {
    const res = await enviarMensaje({ nombre: 'Ana', mensaje: 'entren a http://malo.com/phish', color: '#112233' });

    expect(spyValidar).toHaveBeenCalledTimes(1);
    expect(res.mensaje).toBe('entren a [URL no permitida]');
  });

  test('script en el mensaje: se elimina el codigo malicioso', async () => {
    const res = await enviarMensaje({ nombre: 'Ana', mensaje: 'hola<script>alert(1)</script>', color: '#112233' });

    expect(spyValidar).toHaveBeenCalledTimes(1);
    expect(res.mensaje).toBe('hola');
    expect(res.mensaje).not.toMatch(/<script/i);
  });

  test('img con onerror: no llega ninguna etiqueta ni manejador', async () => {
    const res = await enviarMensaje({ nombre: 'Ana', mensaje: '<img src=x onerror=alert(1)>', color: '#112233' });

    expect(res.mensaje).not.toMatch(/<[a-z]/i);
    expect(res.mensaje).not.toMatch(/onerror/i);
  });

  test('script en nombre y color invalido: se sanean', async () => {
    const res = await enviarMensaje({ nombre: '<script>alert(1)</script>Eva', mensaje: 'hola', color: "red'><b>" });

    expect(res.nombre).toBe('Eva');
    expect(res.color).toBe('#000000');
  });

  test('JSON invalido: la validacion rechaza la entrada', async () => {
    const respuesta = new Promise((resolve) => cliente.once(EVENTO, (r) => resolve(JSON.parse(r))));
    cliente.emit(EVENTO, '{esto no es json');
    const res = await respuesta;

    expect(spyValidar).toHaveBeenCalledTimes(1);
    expect(res.mensaje).toBe('Mensaje invalido');
  });

  test('el mensaje validado se difunde a todos los clientes conectados', async () => {
    const otro = ioClient(url, { transports: ['websocket'], forceNew: true });
    await new Promise((resolve) => otro.on('connect', resolve));

    const recibidoPorOtro = new Promise((resolve) => otro.once(EVENTO, (r) => resolve(JSON.parse(r))));
    const res = await enviarMensaje({ nombre: 'Ana', mensaje: 'https://image.com/a.png', color: '#112233' });
    const resOtro = await recibidoPorOtro;
    otro.disconnect();

    expect(resOtro).toEqual(res);
    expect(resOtro.mensaje).toMatch(/^<img /);
  });

});


describe('HTTP POST /api/mensajes', () => {

  // espera un mensaje difundido o null si no llega en el tiempo dado
  function esperarDifusion(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cliente.off(EVENTO, alRecibir);
        resolve(null);
      }, ms);
      function alRecibir(r) {
        clearTimeout(timer);
        resolve(JSON.parse(r));
      }
      cliente.once(EVENTO, alRecibir);
    });
  }

  test('mensaje valido: llama a validateMessage, responde 201 y lo difunde', async () => {
    const datos = { nombre: 'Ana', mensaje: 'hola', color: '#112233' };
    const difundido = esperarDifusion(3000);
    const res = await request(app).post('/api/mensajes').send(datos);

    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(spyValidar).toHaveBeenCalledTimes(1);
    expect(spyValidar).toHaveBeenCalledWith(JSON.stringify(datos));
    expect(res.body).toEqual({ nombre: 'Ana', mensaje: 'hola', color: '#112233' });
    expect(await difundido).toEqual(res.body);
  });

  test('script por HTTP: la respuesta y lo difundido vienen saneados', async () => {
    const difundido = esperarDifusion(3000);
    const res = await request(app).post('/api/mensajes')
      .send({ nombre: 'Ana', mensaje: 'hola<script>alert(1)</script>', color: '#112233' });

    expect(res.status).toBe(201);
    expect(res.body.mensaje).toBe('hola');
    expect((await difundido).mensaje).toBe('hola');
  });

  test.each([
    ['sin mensaje', { nombre: 'Ana' }],
    ['mensaje vacio', { nombre: 'Ana', mensaje: '   ' }],
    ['mensaje no es texto', { nombre: 'Ana', mensaje: 123 }],
    ['arreglo', [{ mensaje: 'hola' }]]
  ])('%s: responde 400 y no difunde nada', async (_caso, cuerpo) => {
    const difundido = esperarDifusion(300);
    const res = await request(app).post('/api/mensajes').send(cuerpo);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Mensaje invalido' });
    expect(spyValidar).not.toHaveBeenCalled();
    expect(await difundido).toBeNull();
  });

  test('JSON mal formado: responde 400', async () => {
    const res = await request(app).post('/api/mensajes')
      .set('Content-Type', 'application/json')
      .send('{no json');

    expect(res.status).toBe(400);
    expect(spyValidar).not.toHaveBeenCalled();
  });

  test('cuerpo de mas de 10 KB: responde 413', async () => {
    const res = await request(app).post('/api/mensajes')
      .send({ nombre: 'Ana', mensaje: 'a'.repeat(11 * 1024), color: '#112233' });

    expect(res.status).toBe(413);
    expect(spyValidar).not.toHaveBeenCalled();
  });

});


describe('HTTP GET /debug-sentry (retirada, Lab 7)', () => {

  test('la ruta temporal de Sentry ya no existe: responde 404', async () => {
    const res = await request(app).get('/debug-sentry');
    expect(res.status).toBe(404);
  });

});

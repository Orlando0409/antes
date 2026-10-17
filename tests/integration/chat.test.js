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

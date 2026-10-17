var val = require('../libs/unalib');
var assert = require('assert');


// envia un mensaje por validateMessage y devuelve el objeto resultante
function enviar(mensaje, extra){
  var obj = Object.assign({ nombre: 'Tester', mensaje: mensaje, color: '#FF0000' }, extra || {});
  return JSON.parse(val.validateMessage(JSON.stringify(obj)));
}

// silencia los console.log de unalib ("Es una imagen!", etc.) durante las pruebas
var logOriginal = console.log;
before(function(){ console.log = function(){}; });
after(function(){ console.log = logOriginal; });


describe('Validacion de URLs de imagenes', function(){

  describe('is_valid_url_image acepta', function(){

    [
      'http://image.com/image.jpg',
      'https://image.com/image.jpeg',
      'https://image.com/image.png',
      'https://image.com/image.gif',
      'https://image.com/image.bmp',
      'https://image.com/image.webp',
      'https://IMAGE.com/FOTO.JPG',
      'https://image.com/carpeta/sub/foto-1_a.png',
      'https://image.com/foto.png?w=200&h=100',
      'https://www.cafedelescritor.com/wp-content/uploads/mejores-imagenes-gratis.jpg'
    ].forEach(function(url){
      it(url, function(){
        assert.strictEqual(val.is_valid_url_image(url), true);
      });
    });

  });

  describe('is_valid_url_image rechaza', function(){

    [
      ['sin protocolo', 'image.com/image.jpg'],
      ['protocolo ftp', 'ftp://image.com/image.jpg'],
      ['extension no imagen', 'https://image.com/archivo.pdf'],
      ['extension en medio de la ruta', 'https://image.com/image.jpg/otra'],
      ['svg (puede contener scripts)', 'https://image.com/image.svg'],
      ['texto antes de la URL', 'mire http://image.com/image.jpg'],
      ['texto despues de la URL', 'http://image.com/image.jpg genial'],
      ['espacio dentro de la URL', 'http://image.com/mi imagen.jpg'],
      ['credenciales embebidas', 'http://user:pass@image.com/image.jpg'],
      ['valor vacio', ''],
      ['valor no string', 12345]
    ].forEach(function(caso){
      it(caso[0], function(){
        assert.strictEqual(val.is_valid_url_image(caso[1]), false);
      });
    });

  });

  describe('validateMessage muestra la imagen', function(){

    it('convierte la URL en una etiqueta <img> con el src correcto', function(){
      var out = enviar('https://image.com/foto.png');
      assert.strictEqual(out.mensaje,
        '<img src="https://image.com/foto.png" style="max-height: 400px;max-width: 400px;">');
    });

    it('escapa el & del query string dentro del atributo src', function(){
      var out = enviar('https://image.com/foto.png?a=1&b=2');
      assert.ok(out.mensaje.indexOf('src="https://image.com/foto.png?a=1&amp;b=2"') !== -1);
    });

    it('ignora espacios alrededor de la URL', function(){
      var out = enviar('   https://image.com/foto.gif   ');
      assert.ok(out.mensaje.indexOf('<img src="https://image.com/foto.gif"') === 0);
    });

    it('conserva nombre y color del mensaje', function(){
      var out = enviar('https://image.com/foto.gif', { nombre: 'Ana', color: '#00AA00' });
      assert.strictEqual(out.nombre, 'Ana');
      assert.strictEqual(out.color, '#00AA00');
    });

  });

});


describe('Validacion de URLs de videos', function(){

  describe('is_valid_url_video acepta archivos de video', function(){

    [
      'https://videos.com/clip.mp4',
      'https://videos.com/clip.webm',
      'https://videos.com/clip.ogg',
      'https://videos.com/clip.ogv',
      'https://videos.com/clip.mov',
      'https://videos.com/clip.mp4?t=10'
    ].forEach(function(url){
      it(url, function(){
        assert.strictEqual(val.is_valid_url_video(url), true);
      });
    });

  });

  describe('is_valid_url_video rechaza', function(){

    [
      ['extension no video', 'https://videos.com/clip.exe'],
      ['sin protocolo', 'videos.com/clip.mp4'],
      ['texto alrededor', 'vean https://videos.com/clip.mp4'],
      ['comillas en la URL', 'https://videos.com/a".mp4']
    ].forEach(function(caso){
      it(caso[0], function(){
        assert.strictEqual(val.is_valid_url_video(caso[1]), false);
      });
    });

  });

  describe('is_valid_yt_video acepta formatos de YouTube', function(){

    [
      'https://www.youtube.com/watch?v=qYwlqx-JLok',
      'https://youtube.com/watch?v=sgZjbk9eH6g',
      'https://m.youtube.com/watch?v=sgZjbk9eH6g',
      'https://youtu.be/qYwlqx-JLok',
      'https://www.youtube.com/embed/qYwlqx-JLok',
      'https://www.youtube.com/shorts/qYwlqx-JLok',
      'https://www.youtube.com/watch?v=qYwlqx-JLok&t=30s'
    ].forEach(function(url){
      it(url, function(){
        assert.strictEqual(val.is_valid_yt_video(url), true);
      });
    });

  });

  describe('is_valid_yt_video rechaza', function(){

    [
      ['dominio falso con youtube.com en la ruta', 'https://evil.com/youtube.com/watch?v=qYwlqx-JLok'],
      ['subdominio falso', 'https://youtube.com.evil.com/watch?v=qYwlqx-JLok'],
      ['ID demasiado corto', 'https://www.youtube.com/watch?v=abc'],
      ['pagina de canal', 'https://www.youtube.com/@canal']
    ].forEach(function(caso){
      it(caso[0], function(){
        assert.strictEqual(val.is_valid_yt_video(caso[1]), false);
      });
    });

  });

  describe('validateMessage integra el reproductor', function(){

    it('archivo mp4 genera <video> con controles', function(){
      var out = enviar('https://videos.com/clip.mp4');
      assert.strictEqual(out.mensaje,
        '<video src="https://videos.com/clip.mp4" controls style="max-height: 400px;max-width: 400px;">Su navegador no soporta video.</video>');
    });

    it('YouTube watch?v= genera iframe embed con el ID', function(){
      var out = enviar('https://www.youtube.com/watch?v=sgZjbk9eH6g');
      assert.ok(out.mensaje.indexOf('<iframe') === 0);
      assert.ok(out.mensaje.indexOf('src="https://www.youtube.com/embed/sgZjbk9eH6g"') !== -1);
      assert.ok(out.mensaje.indexOf('allowfullscreen') !== -1);
    });

    it('youtu.be genera el mismo embed', function(){
      var out = enviar('https://youtu.be/sgZjbk9eH6g');
      assert.ok(out.mensaje.indexOf('src="https://www.youtube.com/embed/sgZjbk9eH6g"') !== -1);
    });

    it('el iframe solo usa el ID, no el resto de la URL', function(){
      var out = enviar('https://www.youtube.com/watch?v=sgZjbk9eH6g&x=<b>');
      assert.strictEqual(out.mensaje.indexOf('<b>'), -1);
    });

    it('getYTVideoId extrae el ID de 11 caracteres', function(){
      assert.strictEqual(val.getYTVideoId('https://www.youtube.com/watch?v=qYwlqx-JLok&t=5'), 'qYwlqx-JLok');
      assert.strictEqual(val.getYTVideoId('https://youtu.be/qYwlqx-JLok'), 'qYwlqx-JLok');
    });

  });

});


describe('Prevencion de inyeccion de scripts', function(){

  // ningun mensaje resultante debe contener codigo ejecutable
  function assertSinCodigo(texto){
    assert.strictEqual(/<\s*script/i.test(texto), false, 'contiene <script>: ' + texto);
    assert.strictEqual(/<[a-z]/i.test(texto), false, 'contiene etiqueta HTML: ' + texto);
    assert.strictEqual(/javascript\s*:/i.test(texto), false, 'contiene javascript: ' + texto);
    assert.strictEqual(/\bon[a-z]+\s*=/i.test(texto), false, 'contiene manejador de evento: ' + texto);
  }

  describe('payloads XSS en el mensaje quedan bloqueados', function(){

    [
      '<script>alert(1)</script>',
      '<SCRIPT>alert(1)</SCRIPT>',
      '<script src="http://malo.com/x.js"></script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<svg><script>alert(1)</script></svg>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<a href="javascript:alert(1)">clic</a>',
      '<body onload=alert(1)>',
      '<div style="background:url(javascript:alert(1))">',
      '<scr<script>ipt>alert(1)</script>',
      '"><script>alert(1)</script>',
      '<!--<script>alert(1)</script>-->',
      'javascript:alert(document.cookie)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>'
    ].forEach(function(payload){
      it(payload, function(){
        assertSinCodigo(enviar(payload).mensaje);
      });
    });

  });

  describe('resultados exactos de la limpieza', function(){

    it('elimina el bloque <script> completo y conserva el texto', function(){
      assert.strictEqual(enviar('hola<script>alert(1)</script>mundo').mensaje, 'holamundo');
    });

    it('elimina etiqueta con onerror y conserva el texto', function(){
      assert.strictEqual(enviar('<img src=x onerror=alert(1)>texto').mensaje, 'texto');
    });

    it('elimina el esquema javascript:', function(){
      assert.strictEqual(enviar('javascript:alert(1)').mensaje, 'alert(1)');
    });

    it('texto normal no se modifica', function(){
      assert.strictEqual(enviar('Hola, como estan? 2 + 2 = 4').mensaje, 'Hola, como estan? 2 + 2 = 4');
    });

    it('caracteres especiales sueltos se escapan', function(){
      assert.strictEqual(enviar('a < b & "c"').mensaje, 'a &lt; b &amp; &quot;c&quot;');
    });

  });

  describe('URLs no permitidas', function(){

    it('URL que no es imagen ni video se bloquea', function(){
      assert.strictEqual(enviar('vea http://malo.com/phish').mensaje, 'vea [URL no permitida]');
    });

    it('URL www. sin protocolo se bloquea', function(){
      assert.strictEqual(enviar('entre a www.malo.com').mensaje, 'entre a [URL no permitida]');
    });

    it('URL de imagen dentro de un texto se conserva como texto', function(){
      assert.strictEqual(enviar('vea http://image.com/a.jpg').mensaje, 'vea http://image.com/a.jpg');
    });

    it('URL de imagen que intenta romper el atributo no genera <img>', function(){
      var out = enviar('http://x.com/a" onerror="alert(1).jpg');
      assert.strictEqual(out.mensaje.indexOf('<img'), -1);
      assertSinCodigo(out.mensaje);
    });

  });

  describe('nombre y color', function(){

    it('elimina script del nombre', function(){
      var out = enviar('hola', { nombre: '<script>alert(1)</script>Ana' });
      assert.strictEqual(out.nombre, 'Ana');
    });

    it('nombre vacio despues de limpiar queda como Anonimo', function(){
      var out = enviar('hola', { nombre: '<b></b>' });
      assert.strictEqual(out.nombre, 'Anonimo');
    });

    it('nombre se limita a 30 caracteres', function(){
      var out = enviar('hola', { nombre: 'x'.repeat(100) });
      assert.strictEqual(out.nombre.length, 30);
    });

    it('color con inyeccion CSS se reemplaza por #000000', function(){
      var out = enviar('hola', { color: "red'><script>alert(1)</script>" });
      assert.strictEqual(out.color, '#000000');
    });

  });

  describe('integridad de los datos', function(){

    it('mensaje se limita a 500 caracteres', function(){
      assert.ok(enviar('a'.repeat(1000)).mensaje.length <= 500);
    });

    it('descarta campos extra del JSON', function(){
      var out = enviar('hola', { admin: true, __proto__x: 1 });
      assert.deepStrictEqual(Object.keys(out).sort(), ['color', 'mensaje', 'nombre']);
    });

    it('campo mensaje que no es string queda vacio', function(){
      assert.strictEqual(enviar({ a: '<script>' }).mensaje, '');
    });

    it('JSON invalido devuelve "Mensaje invalido"', function(){
      assert.strictEqual(JSON.parse(val.validateMessage('{no json')).mensaje, 'Mensaje invalido');
    });

    it('JSON que no es objeto devuelve "Mensaje invalido"', function(){
      assert.strictEqual(JSON.parse(val.validateMessage('[1,2,3]')).mensaje, 'Mensaje invalido');
    });

    it('entrada vacia o no string devuelve mensaje vacio', function(){
      assert.strictEqual(JSON.parse(val.validateMessage('')).mensaje, '');
      assert.strictEqual(JSON.parse(val.validateMessage(null)).mensaje, '');
    });

  });

});

// Pruebas unitarias BDD de una-lib (mocha + chai expect)
// Estructura: Funcionalidad (describe) > Dado (context) > Cuando (context) > Entonces (it)
// Specs: openspec/specs/chat-multimedia/spec.md y openspec/specs/validacion-mensajes/spec.md

var expect = require('chai').expect;
var val = require('../libs/unalib');


// Cuando: el backend valida el mensaje -> devuelve el objeto que recibiran los clientes
function validar(mensaje, extra){
  var obj = Object.assign({ nombre: 'Tester', mensaje: mensaje, color: '#FF0000' }, extra || {});
  return JSON.parse(val.validateMessage(JSON.stringify(obj)));
}

// ningun texto resultante debe contener codigo ejecutable
function expectSinCodigo(texto){
  expect(texto, 'contiene <script>').to.not.match(/<\s*script/i);
  expect(texto, 'contiene etiqueta HTML').to.not.match(/<[a-z]/i);
  expect(texto, 'contiene javascript:').to.not.match(/javascript\s*:/i);
  expect(texto, 'contiene manejador de evento').to.not.match(/\bon[a-z]+\s*=/i);
}

// silencia los console.log de una-lib ("Es una imagen!", etc.)
var logOriginal = console.log;
before(function(){ console.log = function(){}; });
after(function(){ console.log = logOriginal; });


describe('Funcionalidad: compartir imagenes en el chat', function(){

  context('Dado un mensaje que es solo una URL de imagen valida', function(){

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
      context('Cuando se evalua ' + url, function(){
        it('Entonces is_valid_url_image debe aceptarla', function(){
          expect(val.is_valid_url_image(url)).to.be.true;
        });
      });
    });

    context('Cuando el backend valida el mensaje', function(){
      var out;
      beforeEach(function(){ out = validar('https://image.com/foto.png', { nombre: 'Ana', color: '#00AA00' }); });

      it('Entonces debe devolver una etiqueta <img> con esa URL como src', function(){
        expect(out.mensaje).to.equal('<img src="https://image.com/foto.png" style="max-height: 400px;max-width: 400px;">');
      });

      it('Entonces debe conservar el nombre y el color', function(){
        expect(out).to.include({ nombre: 'Ana', color: '#00AA00' });
      });
    });

    context('Cuando la URL tiene query string con &', function(){
      it('Entonces debe escapar el & dentro del atributo src', function(){
        expect(validar('https://image.com/foto.png?a=1&b=2').mensaje)
          .to.contain('src="https://image.com/foto.png?a=1&amp;b=2"');
      });
    });

    context('Cuando la URL tiene espacios alrededor', function(){
      it('Entonces debe ignorarlos y generar la imagen', function(){
        expect(validar('   https://image.com/foto.gif   ').mensaje).to.match(/^<img src="https:\/\/image\.com\/foto\.gif"/);
      });
    });

  });

  context('Dado un mensaje que NO es una URL de imagen valida', function(){

    [
      ['sin protocolo', 'image.com/image.jpg'],
      ['con protocolo ftp', 'ftp://image.com/image.jpg'],
      ['con extension que no es imagen', 'https://image.com/archivo.pdf'],
      ['con la extension en medio de la ruta', 'https://image.com/image.jpg/otra'],
      ['que apunta a un svg (puede contener scripts)', 'https://image.com/image.svg'],
      ['con texto antes de la URL', 'mire http://image.com/image.jpg'],
      ['con texto despues de la URL', 'http://image.com/image.jpg genial'],
      ['con espacios dentro de la URL', 'http://image.com/mi imagen.jpg'],
      ['con credenciales embebidas', 'http://user:pass@image.com/image.jpg'],
      ['vacio', ''],
      ['que no es string', 12345]
    ].forEach(function(caso){
      context('Cuando el mensaje es ' + caso[0], function(){
        it('Entonces is_valid_url_image debe rechazarlo', function(){
          expect(val.is_valid_url_image(caso[1])).to.be.false;
        });
      });
    });

  });

});


describe('Funcionalidad: compartir videos en el chat', function(){

  context('Dado un mensaje que es solo una URL de archivo de video', function(){

    ['mp4', 'webm', 'ogg', 'ogv', 'mov'].forEach(function(ext){
      context('Cuando la extension es .' + ext, function(){
        it('Entonces is_valid_url_video debe aceptarla', function(){
          expect(val.is_valid_url_video('https://videos.com/clip.' + ext)).to.be.true;
        });
      });
    });

    context('Cuando la URL tiene query string', function(){
      it('Entonces debe aceptarla', function(){
        expect(val.is_valid_url_video('https://videos.com/clip.mp4?t=10')).to.be.true;
      });
    });

    context('Cuando el backend valida el mensaje', function(){
      it('Entonces debe integrar un reproductor <video> con controles', function(){
        expect(validar('https://videos.com/clip.mp4').mensaje).to.equal(
          '<video src="https://videos.com/clip.mp4" controls style="max-height: 400px;max-width: 400px;">Su navegador no soporta video.</video>');
      });
    });

  });

  context('Dado un mensaje que NO es un video valido', function(){

    [
      ['con extension .exe', 'https://videos.com/clip.exe'],
      ['sin protocolo', 'videos.com/clip.mp4'],
      ['con texto alrededor', 'vean https://videos.com/clip.mp4'],
      ['con comillas en la URL', 'https://videos.com/a".mp4']
    ].forEach(function(caso){
      context('Cuando el mensaje es ' + caso[0], function(){
        it('Entonces is_valid_url_video debe rechazarlo', function(){
          expect(val.is_valid_url_video(caso[1])).to.be.false;
        });
      });
    });

  });

  context('Dado un mensaje que es una URL de YouTube', function(){

    [
      'https://www.youtube.com/watch?v=qYwlqx-JLok',
      'https://youtube.com/watch?v=sgZjbk9eH6g',
      'https://m.youtube.com/watch?v=sgZjbk9eH6g',
      'https://youtu.be/qYwlqx-JLok',
      'https://www.youtube.com/embed/qYwlqx-JLok',
      'https://www.youtube.com/shorts/qYwlqx-JLok',
      'https://www.youtube.com/watch?v=qYwlqx-JLok&t=30s'
    ].forEach(function(url){
      context('Cuando se evalua ' + url, function(){
        it('Entonces is_valid_yt_video debe aceptarla', function(){
          expect(val.is_valid_yt_video(url)).to.be.true;
        });
      });
    });

    context('Cuando el backend valida una URL watch?v=', function(){
      var out;
      beforeEach(function(){ out = validar('https://www.youtube.com/watch?v=sgZjbk9eH6g'); });

      it('Entonces debe integrar un iframe embed con el ID', function(){
        expect(out.mensaje).to.match(/^<iframe /);
        expect(out.mensaje).to.contain('src="https://www.youtube.com/embed/sgZjbk9eH6g"');
        expect(out.mensaje).to.contain('allowfullscreen');
      });
    });

    context('Cuando el backend valida una URL youtu.be', function(){
      it('Entonces debe generar el mismo embed', function(){
        expect(validar('https://youtu.be/sgZjbk9eH6g').mensaje).to.contain('src="https://www.youtube.com/embed/sgZjbk9eH6g"');
      });
    });

    context('Cuando la URL trae contenido extra despues del ID', function(){
      it('Entonces el iframe debe usar solo el ID', function(){
        expect(validar('https://www.youtube.com/watch?v=sgZjbk9eH6g&x=<b>').mensaje).to.not.contain('<b>');
      });
    });

    context('Cuando se extrae el ID', function(){
      it('Entonces getYTVideoId debe devolver los 11 caracteres', function(){
        expect(val.getYTVideoId('https://www.youtube.com/watch?v=qYwlqx-JLok&t=5')).to.equal('qYwlqx-JLok');
        expect(val.getYTVideoId('https://youtu.be/qYwlqx-JLok')).to.equal('qYwlqx-JLok');
      });
    });

  });

  context('Dado una URL que se hace pasar por YouTube', function(){

    [
      ['con youtube.com en la ruta de otro dominio', 'https://evil.com/youtube.com/watch?v=qYwlqx-JLok'],
      ['con subdominio falso', 'https://youtube.com.evil.com/watch?v=qYwlqx-JLok'],
      ['con ID demasiado corto', 'https://www.youtube.com/watch?v=abc'],
      ['que es una pagina de canal', 'https://www.youtube.com/@canal']
    ].forEach(function(caso){
      context('Cuando la URL es ' + caso[0], function(){
        it('Entonces is_valid_yt_video debe rechazarla', function(){
          expect(val.is_valid_yt_video(caso[1])).to.be.false;
        });
      });
    });

  });

});


describe('Funcionalidad: prevencion de inyeccion de scripts', function(){

  context('Dado un mensaje con un payload XSS', function(){

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
      context('Cuando el backend valida ' + payload, function(){
        it('Entonces el resultado no debe contener codigo ejecutable', function(){
          expectSinCodigo(validar(payload).mensaje);
        });
      });
    });

  });

  context('Dado texto mezclado con codigo malicioso', function(){

    context('Cuando contiene un bloque <script>', function(){
      it('Entonces debe eliminar el bloque y conservar el texto', function(){
        expect(validar('hola<script>alert(1)</script>mundo').mensaje).to.equal('holamundo');
      });
    });

    context('Cuando contiene una etiqueta con onerror', function(){
      it('Entonces debe eliminar la etiqueta y conservar el texto', function(){
        expect(validar('<img src=x onerror=alert(1)>texto').mensaje).to.equal('texto');
      });
    });

    context('Cuando contiene el esquema javascript:', function(){
      it('Entonces debe eliminar el esquema', function(){
        expect(validar('javascript:alert(1)').mensaje).to.equal('alert(1)');
      });
    });

  });

  context('Dado un texto normal', function(){

    context('Cuando no tiene HTML', function(){
      it('Entonces no debe modificarse', function(){
        expect(validar('Hola, como estan? 2 + 2 = 4').mensaje).to.equal('Hola, como estan? 2 + 2 = 4');
      });
    });

    context('Cuando tiene caracteres especiales sueltos', function(){
      it('Entonces debe escaparlos', function(){
        expect(validar('a < b & "c"').mensaje).to.equal('a &lt; b &amp; &quot;c&quot;');
      });
    });

  });

  context('Dado un texto con URLs', function(){

    context('Cuando la URL no es imagen ni video', function(){
      it('Entonces debe reemplazarse por [URL no permitida]', function(){
        expect(validar('vea http://malo.com/phish').mensaje).to.equal('vea [URL no permitida]');
      });
    });

    context('Cuando la URL empieza con www. sin protocolo', function(){
      it('Entonces debe reemplazarse por [URL no permitida]', function(){
        expect(validar('entre a www.malo.com').mensaje).to.equal('entre a [URL no permitida]');
      });
    });

    context('Cuando la URL es de imagen pero va dentro de un texto', function(){
      it('Entonces debe conservarse como texto', function(){
        expect(validar('vea http://image.com/a.jpg').mensaje).to.equal('vea http://image.com/a.jpg');
      });
    });

    context('Cuando la URL de imagen intenta romper el atributo src', function(){
      it('Entonces no debe generar <img> ni codigo ejecutable', function(){
        var out = validar('http://x.com/a" onerror="alert(1).jpg');
        expect(out.mensaje).to.not.contain('<img');
        expectSinCodigo(out.mensaje);
      });
    });

  });

  context('Dado un nombre o color manipulado', function(){

    context('Cuando el nombre contiene un script', function(){
      it('Entonces debe eliminarlo', function(){
        expect(validar('hola', { nombre: '<script>alert(1)</script>Ana' }).nombre).to.equal('Ana');
      });
    });

    context('Cuando el nombre queda vacio despues de limpiar', function(){
      it('Entonces debe usarse Anonimo', function(){
        expect(validar('hola', { nombre: '<b></b>' }).nombre).to.equal('Anonimo');
      });
    });

    context('Cuando el nombre es demasiado largo', function(){
      it('Entonces debe limitarse a 30 caracteres', function(){
        expect(validar('hola', { nombre: 'x'.repeat(100) }).nombre).to.have.lengthOf(30);
      });
    });

    context('Cuando el color trae inyeccion CSS', function(){
      it('Entonces debe reemplazarse por #000000', function(){
        expect(validar('hola', { color: "red'><script>alert(1)</script>" }).color).to.equal('#000000');
      });
    });

  });

});


describe('Funcionalidad: integridad de los datos', function(){

  context('Dado un mensaje demasiado largo', function(){
    context('Cuando se valida', function(){
      it('Entonces debe limitarse a 500 caracteres', function(){
        expect(validar('a'.repeat(1000)).mensaje.length).to.be.at.most(500);
      });
    });
  });

  context('Dado un JSON con campos extra', function(){
    context('Cuando se valida', function(){
      it('Entonces solo debe devolver nombre, mensaje y color', function(){
        expect(validar('hola', { admin: true, __proto__x: 1 })).to.have.all.keys('nombre', 'mensaje', 'color');
      });
    });
  });

  context('Dado un campo mensaje que no es string', function(){
    context('Cuando se valida', function(){
      it('Entonces el mensaje debe quedar vacio', function(){
        expect(validar({ a: '<script>' }).mensaje).to.equal('');
      });
    });
  });

  context('Dado un JSON mal formado', function(){
    context('Cuando se valida', function(){
      it('Entonces debe responder "Mensaje invalido"', function(){
        expect(JSON.parse(val.validateMessage('{no json')).mensaje).to.equal('Mensaje invalido');
      });
    });
  });

  context('Dado un JSON que no es objeto', function(){
    context('Cuando se valida', function(){
      it('Entonces debe responder "Mensaje invalido"', function(){
        expect(JSON.parse(val.validateMessage('[1,2,3]')).mensaje).to.equal('Mensaje invalido');
      });
    });
  });

  context('Dado una entrada vacia o nula', function(){
    context('Cuando se valida', function(){
      it('Entonces debe devolver un mensaje vacio sin fallar', function(){
        expect(JSON.parse(val.validateMessage('')).mensaje).to.equal('');
        expect(JSON.parse(val.validateMessage(null)).mensaje).to.equal('');
      });
    });
  });

});

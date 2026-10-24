// Prueba que falla a proposito para evidenciar que el pipeline bloquea el despliegue.
// Se revierte en el commit siguiente.

var expect = require('chai').expect;
var val = require('../libs/unalib');

describe('Funcionalidad: Fallo intencional del pipeline', function(){
  context('Dado un mensaje con <script>', function(){
    context('Cuando se valida', function(){
      it('Entonces debe conservar el <script> sin sanear (falla a proposito)', function(){
        var obj = { nombre: 'Tester', mensaje: '<script>alert(1)</script>', color: '#FF0000' };
        var res = JSON.parse(val.validateMessage(JSON.stringify(obj)));
        expect(res.mensaje).to.equal('<script>alert(1)</script>');
      });
    });
  });
});

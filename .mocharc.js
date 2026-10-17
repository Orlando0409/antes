// Mocha: solo pruebas unitarias BDD de test/ (jest usa tests/integration, playwright tests/e2e)
module.exports = {
  spec: ['test/**/*.js'],
  ignore: ['tests/**'],
};

// modulo de ejemplo.

// caracteres permitidos en una URL (sin espacios, comillas ni < >)
var URL_CHARS = "[^\\s\"'<>`]";

// limites de longitud
var MAX_NOMBRE = 30;
var MAX_MENSAJE = 500;
var MAX_URL = 2048;

// hosts de YouTube aceptados
var YT_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];

module.exports = {


    // logica que valida si un telefono esta correcto...
    is_valid_phone: function (phone) {
      // inicializacion lazy
      var isValid = false;
      // expresion regular copiada de StackOverflow
      var re = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/i;

      // validacion Regex
      try {
        isValid = re.test(phone);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    // valida que sea una URL http(s) bien formada (regex + parser WHATWG URL)
    is_safe_http_url: function (url) {
      if (typeof url !== 'string' || url.length > MAX_URL) {
        return false;
      }
      if (!new RegExp("^https?:\\/\\/" + URL_CHARS + "+$", "i").test(url)) {
        return false;
      }
      try {
        var parsed = new URL(url);
        // solo http/https, con host valido y sin credenciales embebidas
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
          /^[a-z0-9.-]+\.[a-z]{2,}$|^localhost$/i.test(parsed.hostname) &&
          parsed.username === '' && parsed.password === '';
      } catch (e) {
        return false;
      }
    },

    is_valid_url_image: function (url) {

      // inicializacion lazy
      var isValid = false;
      // URL http(s) completa que termina en extension de imagen (query string opcional)
      // se excluye .svg porque puede contener scripts si se abre directamente
      var re = new RegExp("^https?:\\/\\/" + URL_CHARS + "+\\.(?:jpg|jpeg|gif|png|bmp|webp)(?:[?#]" + URL_CHARS + "*)?$", "i");

      // validacion Regex
      try {
        isValid = re.test(url) && this.is_safe_http_url(url);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    is_valid_url_video: function (url) {

      // inicializacion lazy
      var isValid = false;
      // URL http(s) completa que termina en extension de video (query string opcional)
      var re = new RegExp("^https?:\\/\\/" + URL_CHARS + "+\\.(?:mp4|webm|ogg|ogv|mov)(?:[?#]" + URL_CHARS + "*)?$", "i");

      // validacion Regex
      try {
        isValid = re.test(url) && this.is_safe_http_url(url);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    is_valid_yt_video: function (url) {

      // inicializacion lazy
      var isValid = false;
      // youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
      var re = /^https?:\/\/(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))[\w-]{11}(?:[?&#][^\s"'<>`]*)?$/i;

      // validacion Regex + host exacto de YouTube
      try {
        isValid = re.test(url) && this.is_safe_http_url(url) &&
          YT_HOSTS.indexOf(new URL(url).hostname.toLowerCase()) !== -1;
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    getYTVideoId: function(url){

      return url.match(/(?:youtu\.be\/|embed\/|v\/|shorts\/|[?&]v=)([\w-]{11})/)[1];
    },

    // escapa caracteres especiales de HTML para evitar inyeccion (XSS)
    escapeHtml: function(text){
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // elimina codigo malicioso: bloques script/style/iframe, etiquetas HTML,
    // manejadores de eventos y esquemas peligrosos (javascript:, data:, vbscript:)
    removeMaliciousCode: function(text){
      return String(text)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/<\s*(script|style|iframe|object|embed|svg|math|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\/?[a-z!][^>]*>?/gi, '')
        .replace(/\bon[a-z]+\s*=/gi, '')
        .replace(/\b(?:javascript|vbscript|data)\s*:/gi, '')
        .trim();
    },

    // reemplaza cualquier URL dentro de un texto que no sea imagen/video valido
    removeDisallowedUrls: function(text){
      var self = this;
      return text.replace(/\b(?:https?:\/\/|www\.)\S+/gi, function(url){
        if (self.is_valid_url_image(url) || self.is_valid_url_video(url) || self.is_valid_yt_video(url)) {
          return url;
        }
        return '[URL no permitida]';
      });
    },

    getEmbeddedCode: function (url){
      var id = this.getYTVideoId(url);
      var code = '<iframe width="560" height="315" src="https://www.youtube.com/embed/'+id+ '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
      return code;
    },

    getVideoTag: function(url){
      var tag = '<video src="'+this.escapeHtml(url)+'" controls style="max-height: 400px;max-width: 400px;">Su navegador no soporta video.</video>';
      return tag;
    },

    getImageTag: function(url){
      var tag = '<img src="'+this.escapeHtml(url)+'" style="max-height: 400px;max-width: 400px;">';
      return tag;
    },

    validateMessage: function(msg){
      // Handle invalid input
      if (!msg || typeof msg !== 'string') {
        return JSON.stringify({ nombre: 'Sistema', mensaje: '', color: '#000000' });
      }

      try {
        var obj = JSON.parse(msg);

        // la estructura debe ser un objeto con campos string
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
          throw new Error('Estructura de mensaje invalida');
        }

        var nombre = typeof obj.nombre === 'string' ? obj.nombre : '';
        var mensaje = typeof obj.mensaje === 'string' ? obj.mensaje : '';
        var color = typeof obj.color === 'string' ? obj.color : '';

        // solo se devuelven los campos esperados (descarta campos extra)
        var limpio = {};

        // nombre: sin codigo, solo texto, longitud limitada
        nombre = this.removeMaliciousCode(nombre).substring(0, MAX_NOMBRE);
        limpio.nombre = this.escapeHtml(nombre || 'Anonimo');

        // color: solo hexadecimal #RRGGBB
        limpio.color = /^#[0-9A-F]{6}$/i.test(color) ? color : '#000000';

        mensaje = mensaje.trim();

      if(this.is_valid_url_image(mensaje)){
        console.log("Es una imagen!")
        limpio.mensaje = this.getImageTag(mensaje);
      }
      else if(this.is_valid_yt_video(mensaje)){
        console.log("Es un video de YouTube!")
        limpio.mensaje = this.getEmbeddedCode(mensaje);
      }
      else if(this.is_valid_url_video(mensaje)){
        console.log("Es un video!")
        limpio.mensaje = this.getVideoTag(mensaje);
      }
      else{
        console.log("Es un texto!")
        mensaje = this.removeMaliciousCode(mensaje.substring(0, MAX_MENSAJE));
        mensaje = this.removeDisallowedUrls(mensaje);
        limpio.mensaje = this.escapeHtml(mensaje);
      }

      return JSON.stringify(limpio);
      } catch (e) {
        console.log('Error processing message:', e.message);
        return JSON.stringify({ nombre: 'Sistema', mensaje: 'Mensaje invalido', color: '#000000' });
      }
    }






  // fin del modulo
  };


# validacion-mensajes Specification

## Purpose

Garantiza que todo mensaje recibido por el backend pase por `validateMessage` de una-lib antes de difundirse, para impedir inyeccion de scripts (XSS) y asegurar la integridad de los datos.

## Requirements

### Requirement: Validacion obligatoria en el backend
El backend SHALL procesar cada evento `Evento-Mensaje-Server` con `unalib.validateMessage` y difundir a todos los clientes solo el resultado validado.

#### Scenario: Mensaje difundido validado
- **WHEN** un cliente emite un mensaje
- **THEN** el servidor llama a `validateMessage` una vez y emite exactamente su resultado a todos los clientes

### Requirement: Eliminar codigo malicioso
El sistema MUST eliminar de los mensajes de texto y del nombre los bloques script/style/iframe/object/embed/svg, comentarios HTML, cualquier etiqueta, manejadores `on*=` y esquemas `javascript:`, `data:` y `vbscript:`, y escapar el texto restante.

#### Scenario: Bloque script
- **WHEN** un usuario envia `hola<script>alert(1)</script>`
- **THEN** el mensaje difundido es `hola` y no se ejecuta ningun alert en el navegador

#### Scenario: Imagen con onerror
- **WHEN** un usuario envia `<img src=x onerror=alert(1)>`
- **THEN** el mensaje difundido no contiene etiquetas ni `onerror`

### Requirement: Solo URLs multimedia
El sistema MUST reemplazar por `[URL no permitida]` cualquier URL dentro de un texto que no sea una imagen, video o YouTube valido, y MUST rechazar URLs con credenciales o protocolos distintos de http/https.

#### Scenario: URL de phishing
- **WHEN** un usuario envia `vea http://malo.com/phish`
- **THEN** el mensaje difundido es `vea [URL no permitida]`

### Requirement: Integridad de los datos
El sistema MUST aceptar solo un objeto JSON con `nombre`, `mensaje` y `color` de tipo string, descartar campos extra, limitar nombre a 30 y mensaje a 500 caracteres, y forzar `color` a `#RRGGBB` (por defecto `#000000`).

#### Scenario: JSON invalido
- **WHEN** un cliente emite `{no json`
- **THEN** el servidor difunde `Mensaje invalido`

#### Scenario: Color con inyeccion
- **WHEN** un cliente envia `color: "red'><b>"`
- **THEN** el color difundido es `#000000`

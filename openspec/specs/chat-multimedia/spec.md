# chat-multimedia Specification

## Purpose

Permite que los usuarios de UNA Chat compartan imagenes y videos pegando su URL en el campo de mensaje, y que todos los participantes los vean integrados en el chat.

## Requirements

### Requirement: Mostrar imagen desde URL
El sistema SHALL convertir un mensaje compuesto unicamente por una URL http(s) que termina en jpg, jpeg, png, gif, bmp o webp (con query string opcional) en una etiqueta `<img>` con esa URL como `src`.

#### Scenario: URL de imagen valida
- **WHEN** un usuario envia `https://image.com/foto.png`
- **THEN** todos los clientes reciben `<img src="https://image.com/foto.png" ...>` y la imagen se muestra en el chat

#### Scenario: URL de imagen con texto alrededor
- **WHEN** un usuario envia `mire https://image.com/foto.png`
- **THEN** el mensaje se muestra como texto y no se genera `<img>`

#### Scenario: SVG no se acepta como imagen
- **WHEN** un usuario envia `https://image.com/logo.svg`
- **THEN** no se genera `<img>`

### Requirement: Reproducir archivo de video desde URL
El sistema SHALL convertir un mensaje compuesto unicamente por una URL http(s) que termina en mp4, webm, ogg, ogv o mov en un reproductor `<video controls>`.

#### Scenario: URL de video valida
- **WHEN** un usuario envia `https://videos.com/clip.webm`
- **THEN** todos los clientes reciben `<video src="https://videos.com/clip.webm" controls ...>`

### Requirement: Integrar video de YouTube
El sistema SHALL convertir una URL de YouTube (watch?v=, youtu.be, embed, shorts, m.) cuyo host sea exactamente un dominio de YouTube en un `<iframe>` de `https://www.youtube.com/embed/<ID>` usando solo el ID de 11 caracteres.

#### Scenario: URL watch de YouTube
- **WHEN** un usuario envia `https://www.youtube.com/watch?v=sgZjbk9eH6g`
- **THEN** se genera un iframe con `src="https://www.youtube.com/embed/sgZjbk9eH6g"`

#### Scenario: Dominio falso de YouTube
- **WHEN** un usuario envia `https://evil.com/youtube.com/watch?v=sgZjbk9eH6g`
- **THEN** no se genera iframe

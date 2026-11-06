# Spec Delta

## Purpose

Permite entrar a UNA Chat con Auth0 y usar la sala con esa identidad, sin exigir sesion en los entornos de prueba que no configuran Auth0.

## ADDED Requirements

### Requirement: Login segun el entorno
El sistema SHALL exigir sesion solo cuando `AUTH0_DOMAIN` y `AUTH0_CLIENT_ID` tienen valor. Sin alguno de los dos, el chat MUST seguir disponible sin sesion.

#### Scenario: Auth0 sin configurar
- **WHEN** un cliente pide `GET /auth/config` y el servidor no tiene dominio o Client ID
- **THEN** la respuesta es 200 con `enabled` en `false`

#### Scenario: Chat abierto sin Auth0
- **WHEN** un cliente sin sesion se conecta al socket y el servidor no tiene Auth0 configurado
- **THEN** la conexion se acepta y sus mensajes se difunden

#### Scenario: Auth0 configurado
- **WHEN** un cliente pide `GET /auth/config` y el servidor tiene dominio y Client ID
- **THEN** la respuesta es 200 con `enabled` en `true`, el dominio y el Client ID

### Requirement: Inicio de sesion con Auth0
`GET /auth/login` SHALL redirigir con 302 al dominio de Auth0 usando authorization code con PKCE, `state` y `nonce`. `GET /auth/callback` MUST aceptar la respuesta solo si `state` coincide con la transaccion guardada en una cookie firmada, y MUST rechazar el ID token si su firma, emisor, audiencia o `nonce` no son validos.

#### Scenario: Redireccion a Auth0
- **WHEN** un cliente pide `GET /auth/login`
- **THEN** la respuesta es 302 a `https://<dominio>/authorize` con `code_challenge`, `state` y `nonce`

#### Scenario: State que no coincide
- **WHEN** `GET /auth/callback` recibe un `state` distinto al de la transaccion
- **THEN** no se canjea el codigo, no se crea sesion y se redirige a `/?error=state`

#### Scenario: Canje rechazado
- **WHEN** Auth0 rechaza el canje del codigo
- **THEN** no se crea sesion, se redirige a `/?error=login_failed` y el log contiene solo un codigo de error conocido

#### Scenario: Inicio cancelado
- **WHEN** Auth0 vuelve a `/auth/callback` con `error`
- **THEN** no se crea sesion, se redirige a `/?error=access_denied` y la pagina ofrece reintentar

### Requirement: Cookie de sesion protegida
Las cookies de sesion y de transaccion MUST ser `HttpOnly` y `SameSite=Lax`, y MUST llevar `Secure` cuando `APP_BASE_URL` es HTTPS.

#### Scenario: Despliegue con HTTPS
- **WHEN** `GET /auth/login` responde en un servidor con `APP_BASE_URL` HTTPS
- **THEN** la cookie de transaccion lleva `HttpOnly`, `SameSite=Lax` y `Secure`

### Requirement: Sala protegida
Con Auth0 configurado, `GET /sala` SHALL devolver el nombre de la persona solo a quien presenta una sesion valida. En cualquier otro caso MUST responder 401.

#### Scenario: Sin cookie
- **WHEN** un cliente sin cookie de sesion pide `GET /sala`
- **THEN** la respuesta es 401 y pide iniciar sesion

#### Scenario: Sesion invalida
- **WHEN** un cliente pide `GET /sala` con un token falso, vencido o de otra audiencia
- **THEN** la respuesta es 401

#### Scenario: Sesion valida
- **WHEN** un cliente con un ID token valido pide `GET /sala`
- **THEN** la respuesta es 200 con el nombre de la persona

### Requirement: Mensajes solo con sesion
Con Auth0 configurado, el sistema MUST rechazar sin difundir nada los mensajes de quien no tiene sesion valida, tanto por socket como por `POST /api/mensajes`.

#### Scenario: Socket sin sesion
- **WHEN** un cliente sin cookie de sesion intenta conectarse al socket
- **THEN** la conexion se rechaza

#### Scenario: HTTP sin sesion
- **WHEN** un cliente sin cookie de sesion envia `POST /api/mensajes`
- **THEN** la respuesta es 401 y no se difunde ningun mensaje

### Requirement: Remitente autenticado
Con sesion activa, el nombre difundido SHALL salir de la sesion e ignorar el `nombre` enviado por el cliente. Ese nombre MUST pasar por `validateMessage` como cualquier otro dato.

#### Scenario: Suplantacion de nombre
- **WHEN** una persona autenticada como Ana envia un mensaje con `nombre` igual a `Admin`
- **THEN** el mensaje difundido lleva el nombre `Ana`

#### Scenario: Nombre de Auth0 con codigo
- **WHEN** el nombre de la sesion contiene `<script>alert(1)</script>Ana`
- **THEN** el nombre difundido no contiene etiquetas

#### Scenario: JSON invalido con sesion
- **WHEN** una persona autenticada emite `{no json`
- **THEN** el servidor difunde `Mensaje invalido`

### Requirement: Cierre de sesion
`GET /auth/logout` SHALL borrar las cookies de sesion y redirigir al cierre de sesion de Auth0, que devuelve a la aplicacion.

#### Scenario: Cerrar sesion
- **WHEN** una persona autenticada pide `GET /auth/logout`
- **THEN** la cookie de sesion se borra y la respuesta redirige a `https://<dominio>/`

### Requirement: Identidad visible en la pagina
Con Auth0 configurado, la pagina SHALL mostrar una pantalla de inicio de sesion hasta que haya sesion, y despues el nombre de la persona y un boton Cerrar sesion. Sin Auth0, la pagina MUST conservar el campo de nombre y no mostrar esos controles.

#### Scenario: Pagina con sesion
- **WHEN** una persona autenticada abre el chat
- **THEN** ve su nombre y el boton Cerrar sesion, y el chat se conecta

#### Scenario: Pagina sin sesion
- **WHEN** un visitante sin sesion abre el chat con Auth0 configurado
- **THEN** ve el boton Iniciar sesion y el chat no se conecta

#### Scenario: Pagina sin Auth0
- **WHEN** un visitante abre el chat y Auth0 no esta configurado
- **THEN** ve el campo de nombre y puede enviar mensajes

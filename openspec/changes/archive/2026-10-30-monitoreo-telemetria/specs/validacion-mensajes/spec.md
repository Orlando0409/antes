# Spec Delta

## ADDED Requirements

### Requirement: Envio de mensajes por HTTP
El backend SHALL aceptar `POST /api/mensajes` con un objeto JSON, procesarlo con `unalib.validateMessage`, difundir el resultado validado a todos los clientes de Socket.IO y responder 201 con ese resultado. Si el cuerpo no es un objeto con `mensaje` de texto no vacio MUST responder 400 sin difundir nada.

#### Scenario: Mensaje HTTP valido
- **WHEN** un cliente envia `POST /api/mensajes` con `{"nombre":"Ana","mensaje":"hola","color":"#112233"}`
- **THEN** el servidor llama a `validateMessage` una vez, responde 201 con su resultado y lo difunde a los clientes conectados

#### Scenario: Script por HTTP
- **WHEN** un cliente envia por HTTP el mensaje `hola<script>alert(1)</script>`
- **THEN** la respuesta y lo difundido contienen `hola` sin etiquetas

#### Scenario: Cuerpo sin mensaje
- **WHEN** un cliente envia `POST /api/mensajes` con `{"nombre":"Ana"}`
- **THEN** el servidor responde 400 y no difunde ningun mensaje

#### Scenario: Cuerpo demasiado grande
- **WHEN** un cliente envia un cuerpo de mas de 10 KB
- **THEN** el servidor responde 413

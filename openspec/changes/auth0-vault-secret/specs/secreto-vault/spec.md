# Spec Delta

## Purpose

Mantiene el Client Secret de Auth0 en Supabase Vault: el servidor lo lee al arrancar con un rol de privilegio minimo y no lo expone, y rotarlo solo requiere actualizar Vault y reiniciar.

## ADDED Requirements

### Requirement: Secreto leido de Vault al arrancar
Con Auth0 configurado, el servidor SHALL obtener el Client Secret de Vault al arrancar, usando la conexion `VAULT_DATABASE_URL`, antes de abrir el puerto. MUST ignorar `AUTH0_CLIENT_SECRET` y avisar en el log si esa variable existe, sin mostrar su valor.

#### Scenario: Arranque correcto
- **WHEN** el servidor arranca con Auth0 configurado y Vault entrega un secreto que Auth0 acepta
- **THEN** el servidor abre el puerto

#### Scenario: Variable anterior presente
- **WHEN** el servidor arranca con `AUTH0_CLIENT_SECRET` definida
- **THEN** usa el valor de Vault y registra un aviso sin el valor de la variable

#### Scenario: Pruebas sin Auth0
- **WHEN** el servidor arranca sin Auth0 configurado
- **THEN** no consulta Vault y abre el puerto

### Requirement: Fallo cerrado
Si no se puede obtener un secreto valido, el proceso MUST terminar sin abrir el puerto y MUST registrar una descripcion del problema sin secreto ni conexion.

#### Scenario: Conexion ausente
- **WHEN** falta `VAULT_DATABASE_URL`
- **THEN** el proceso termina con un mensaje que nombra la variable

#### Scenario: Conexion invalida
- **WHEN** `VAULT_DATABASE_URL` no es una conexion Postgres
- **THEN** el proceso termina sin abrir el puerto

#### Scenario: Rol sin permiso
- **WHEN** Postgres responde `42501` al pedir el secreto
- **THEN** el mensaje indica que el rol no puede ejecutar la funcion

#### Scenario: Secreto ausente o demasiado corto
- **WHEN** Vault no devuelve un secreto o tiene menos de 16 caracteres
- **THEN** el proceso termina con un mensaje que nombra `una_chat_auth0_client_secret`

#### Scenario: Error de base con datos sensibles
- **WHEN** un error de la base contiene el secreto o una URI `postgres://`
- **THEN** el mensaje registrado es generico y no contiene esos valores

### Requirement: Conexion a Vault con TLS verificado
La conexion a Vault MUST verificar el certificado del servidor contra las CA del sistema y la CA raiz de Supabase, sin importar el `sslmode` escrito en la conexion.

#### Scenario: Certificado no verificable
- **WHEN** el servidor de base presenta un certificado que no se puede verificar
- **THEN** la conexion falla y el proceso termina con el mensaje de certificado

### Requirement: Comprobacion del secreto contra Auth0
Al arrancar, el servidor SHALL canjear un codigo de prueba falso en `/oauth/token`. `invalid_grant` MUST contar como secreto aceptado; `invalid_client` y cualquier otra respuesta MUST impedir el arranque.

#### Scenario: Secreto vigente
- **WHEN** Auth0 responde `invalid_grant` a la prueba
- **THEN** el inicio de sesion queda disponible

#### Scenario: Secreto rotado o de otra aplicacion
- **WHEN** Auth0 responde `invalid_client` a la prueba
- **THEN** el proceso termina sin abrir el puerto y el mensaje no contiene el secreto

### Requirement: Secreto fuera del alcance del cliente
El Client Secret MUST NOT aparecer en respuestas HTTP, paginas, cookies, logs, Sentry ni telemetria. El codigo de autorizacion de `/auth/callback` MUST NOT exportarse en la telemetria.

#### Scenario: Configuracion publica
- **WHEN** un cliente pide `GET /auth/config`
- **THEN** la respuesta contiene como maximo `enabled`, el dominio y el Client ID

#### Scenario: Error de canje con detalle sensible
- **WHEN** un error de Auth0 contiene el secreto en su descripcion
- **THEN** el log registra solo el codigo de error conocido

### Requirement: Identidad fuera de los logs
Con Auth0 configurado, el log de un mensaje MUST NOT incluir el nombre de la persona, porque puede ser su nombre real o su correo.

#### Scenario: Mensaje con sesion
- **WHEN** una persona autenticada envia un mensaje valido
- **THEN** el log `Mensaje difundido` no contiene `chat.nombre`

### Requirement: Scripts de permisos sin valores sensibles
El repositorio SHALL incluir los scripts que crean la funcion de lectura y comprueban sus privilegios. Solo el rol `una_chat_backend` MUST poder ejecutar la funcion, y `anon`, `authenticated` y `public` MUST recibir `42501`. Los archivos versionados MUST NOT contener secretos, contrasenas ni conexiones reales.

#### Scenario: Archivo de ejemplo
- **WHEN** se revisa `.env.example`
- **THEN** `VAULT_DATABASE_URL` esta vacia y no existe `AUTH0_CLIENT_SECRET` con valor

#### Scenario: Script de privilegios
- **WHEN** se ejecuta `sql/check_vault_privileges.sql` despues del script de acceso
- **THEN** solo `backend_execute` es `true` y el resultado no incluye el valor del secreto

### Requirement: Rotacion sin cambios de codigo
Rotar el secreto SHALL requerir solo actualizar Vault y reiniciar el servicio, sin cambiar codigo ni variables de entorno.

#### Scenario: Reinicio tras rotar
- **WHEN** el secreto se rota en Auth0, se actualiza en Vault y el servicio se reinicia
- **THEN** el servidor arranca con el valor nuevo y un inicio de sesion nuevo llega a la sala

#### Scenario: Rotado en Auth0 pero no en Vault
- **WHEN** el servicio reinicia con el valor anterior en Vault
- **THEN** el proceso termina sin abrir el puerto

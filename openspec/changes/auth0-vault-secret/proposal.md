# Proposal

## Why

El Laboratorio 8 pide mover el Client Secret de Auth0 a Supabase Vault y demostrar su rotacion, y asume que UNA Chat ya trae login y lector de Vault. Este repositorio no tiene ninguno de los dos: hoy cualquiera entra al chat, escribe con cualquier nombre y publica por `POST /api/mensajes` sin autenticarse.

## What Changes

- Login con Auth0 (authorization code + PKCE, metodo Client Secret Post) con las rutas `/auth/config`, `/auth/login`, `/auth/callback`, `/auth/logout` y `/sala`.
- Login segun el entorno: sin `AUTH0_DOMAIN` o `AUTH0_CLIENT_ID` el chat sigue abierto, de modo que CI y las pruebas actuales no cambian.
- Con Auth0 configurado, el socket y `POST /api/mensajes` exigen sesion, y el remitente sale de la sesion, no del cliente. El cierre de `POST /api/mensajes` no existe en el codigo de referencia del curso; aqui es necesario porque esa ruta es propia de este repositorio.
- El servidor lee el secreto de Vault al arrancar con el rol `una_chat_backend` y comprueba con Auth0 que sea valido. Si algo falla, no abre el puerto.
- `index.html` muestra la pantalla de login, el nombre y el boton Cerrar sesion, sin rediseno.
- Scripts `sql/`, certificado raiz de Supabase, `.env.example`, `Dockerfile` y guia del laboratorio.
- La telemetria deja de registrar datos sensibles del login (codigo de autorizacion y nombre real).

## Capabilities

### New Capabilities
- `inicio-sesion`: inicio y cierre de sesion, sala protegida e identidad del remitente cuando Auth0 esta configurado.
- `secreto-vault`: lectura del Client Secret desde Vault al arrancar, fallo cerrado, y secreto fuera de navegador, logs y telemetria.

### Modified Capabilities

Ninguna. `validacion-mensajes` y `monitoreo` conservan sus requisitos: sin Auth0 se comportan igual, y las restricciones nuevas se definen en las capacidades anteriores.

## Impact

- **Codigo**: `server.js`, `index.html`, `libs/telemetria.js`; nuevos `server/auth.js`, `server/vault.js`, `server/supabase-root-2021-ca.pem` y `sql/`, adaptados del repositorio de referencia del curso (`AlexVillegasC/infosec-unachat-2026`).
- **Dependencias de produccion**: `pg` y `pg-connection-string` (Vault por Postgres con TLS verificado), `@auth0/auth0-auth-js` (URLs de login y logout con PKCE) y `express-oauth2-jwt-bearer` (verificacion del ID token). Son las del codigo de referencia; `npm run security:audit` debe seguir en 0.
- **Despliegue**: el servicio de Render necesita `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `APP_BASE_URL` y `VAULT_DATABASE_URL`. **BREAKING** para quien use el chat desplegado: con Auth0 activo hay que iniciar sesion. `artillery/carga.yml` solo funciona contra un servidor sin Auth0.
- **Externo**: proyecto de prueba en Supabase, aplicacion en Auth0. Esa configuracion la hace la persona a mano para que los secretos no pasen por el agente.

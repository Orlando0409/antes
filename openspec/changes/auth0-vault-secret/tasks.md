# Tasks

## 1. Base

- [x] 1.1 Agregar `pg`, `pg-connection-string`, `@auth0/auth0-auth-js` y `express-oauth2-jwt-bearer` con `^`; verificar que `npm run security:audit` queda en 0 y que los modulos cargan con `require` en Node 26
- [x] 1.2 Copiar `sql/una_chat_vault_access.sql`, `sql/check_vault_privileges.sql` y `server/supabase-root-2021-ca.pem`; verificar con `diff` que los SQL coinciden con los recursos del laboratorio y que el PEM es `Supabase Root 2021 CA`
- [x] 1.3 Agregar las variables de Auth0 y Vault vacias a `.env.example`, sin `AUTH0_CLIENT_SECRET`; agregar `COPY server ./server` al `Dockerfile` y verificar que `docker build` termina o, sin Docker, que el archivo copia `server/`

## 2. Lectura del secreto

- [x] 2.1 Escribir en `test/vault.test.js` las pruebas BDD de `Fallo cerrado` y verificar que fallan porque el modulo aun no existe
- [x] 2.2 Portar `server/vault.js` con el TLS verificado y verificar que `npm test` pasa, incluidos conexion ausente, invalida, `42501`, secreto corto y error con datos sensibles

## 3. Sesion y Auth0

- [x] 3.1 Escribir en `test/auth.test.js` las pruebas BDD de `Comprobacion del secreto contra Auth0` (con `fetch` sustituido), `stampSender` (suplantacion y JSON invalido) y base URL; verificar que fallan primero
- [x] 3.2 Portar `server/auth.js` con el cambio de `stampSender` y sin el campo de foto; verificar que `npm test` pasa
- [x] 3.3 Comprobar con una prueba que un error de Auth0 cuya descripcion contiene el secreto solo registra el codigo conocido

## 4. Rutas y gate

- [x] 4.1 Escribir `tests/integration/auth.test.js` con Auth0 activo por entorno: `/auth/config` sin secreto, `/sala` 401 sin cookie y con token falso, `/auth/login` 302 con PKCE, `state` y `nonce`, cookies `HttpOnly`/`SameSite`/`Secure`, callback con `state` incorrecto, socket rechazado y `POST /api/mensajes` 401 sin difusion; verificar que fallan primero
- [x] 4.2 Agregar a `server.js` las rutas y el gate de socket y HTTP antes de `manejarErroresExpress`, y el arranque `boot()` solo con `require.main === module`; verificar que pasan las pruebas de 4.1 y las actuales de `tests/integration/chat.test.js` sin cambios
- [x] 4.3 Probar el arranque real sin Vault: con `AUTH0_*` definidas y sin `VAULT_DATABASE_URL`, `node server.js` termina con codigo 1, nombra la variable y no abre el puerto
- [x] 4.4 Intentar la prueba de sesion valida con JWKS local (`Sesion valida`, `Suplantacion de nombre`, `Nombre de Auth0 con codigo`); si la descarga no se puede interceptar, cubrir `stampSender` + `validateMessage` en unitarias y dejar `Sesion valida` para la verificacion manual 7.3

## 5. Telemetria

- [x] 5.1 Ignorar `/auth/callback` en la instrumentacion HTTP, quitar su query en `beforeSend` de Sentry y omitir `chat.nombre` con Auth0 activo; verificar con pruebas en `test/telemetria.test.js` y que el escenario `Mensaje con sesion` pasa

## 6. Pagina

- [x] 6.1 Agregar a `index.html` la pantalla de login, el nombre con `.text()`, el boton Cerrar sesion y los errores de `?error=`, conectando el socket solo con sesion o con Auth0 desactivado
- [x] 6.2 Agregar a `tests/e2e/chat.spec.js` `Pagina sin Auth0`, y `Pagina sin sesion` y `Pagina con sesion` simulando `/auth/config` y `/sala` con `page.route`; verificar con `npm run test:e2e`

## 7. Documentacion y verificacion

- [x] 7.1 Escribir `docs/lab8.md` con los pasos manuales (Supabase, Auth0, Render, rotacion), comandos `curl` para `/auth/config`, `/sala`, `/auth/login` y la comparacion de secretos, y que evidencia capturar; actualizar `README.md` y la tabla de `AGENTS.md` con `server/` y `sql/`
- [x] 7.2 Ejecutar `npm run check` y `npm run test:e2e` y verificar que pasan
- [ ] 7.3 Verificacion manual de la persona con credenciales reales: arranque local con `npm run start:local`, login en ventana privada, reinicio tras rotar y comparacion `invalid_client` / `invalid_grant`

## Workflow follow-up

- Integrar por PR a `main` con CI en verde, despues de definir las variables en Render.
- Completar la evidencia y la bitacora del laboratorio.
- Archivar el cambio con `/opsx:archive`.

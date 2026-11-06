# Design

## Context

Motivacion en `proposal.md`. El curso publica el codigo de referencia en `AlexVillegasC/infosec-unachat-2026` (rama `master`), pero ese repositorio tiene otra historia: Express 4, sin Sentry, Grafana ni el CI de este proyecto, y con un `index.html` redisenado. Este repositorio usa Express 5, exporta `{ app, http, io }`, instrumenta con `libs/telemetria.js` y tiene una ruta propia, `POST /api/mensajes`, que la referencia no conoce.

Restricciones: `AGENTS.md` (CommonJS, sin `listen` al importar, `validateMessage` como unica entrada) y que CI corre sin secretos ni acceso a Supabase o Auth0.

## Goals / Non-Goals

**Goals:**
- Cumplir el contrato que el laboratorio verifica: rutas, codigos de respuesta, nombres de variables y del secreto, y scripts SQL identicos a los entregados.
- Mantener en verde las pruebas actuales, sin Auth0 en el entorno.

**Non-Goals:**
- Rediseno de la interfaz, foto de perfil ni login social (estan en la referencia, el laboratorio no los evalua).
- Revocar sesiones ya emitidas o cerrar sockets abiertos al vencer el token.
- Automatizar la configuracion de Supabase, Auth0 o Render.

## Decisions

**Portar al repositorio propio en vez de cambiar Render al repositorio de referencia.** Conserva CI, Sentry, Grafana, specs y la evidencia de labs anteriores. Alternativa: hacer fork de la referencia, que es mas rapido pero pierde todo eso.

**Reutilizar `server/vault.js` y `server/auth.js` casi sin cambios.** Son el comportamiento que el laboratorio describe. Alternativa: usar `jose` y construir a mano las URLs de autorizacion. Quitaria dos dependencias y el `req`/`res` simulado de `verifyToken`, pero se aleja del material del curso y agrega codigo de seguridad propio. Queda como mejora futura.

**Cambios respecto a la referencia:**
- `stampSender` deja pasar sin cambios el cuerpo que no es un objeto JSON. La referencia convierte `{no json` en un mensaje valido, lo que contradice el escenario `JSON invalido` de `validacion-mensajes`.
- `POST /api/mensajes` usa el mismo gate de sesion que el socket. Sin esto, la ruta seria un bypass completo del login.
- Se declara `pg-connection-string` como dependencia directa, porque se usa con `require`. Hace falta parsear la URI y fijar `ssl` despues: en `pg`, el `sslmode` de la cadena sobrescribe la configuracion `ssl`.
- `/sala` devuelve solo `name`. Correo y foto no los usa esta interfaz.

**No cargar `.env` automaticamente (sin `dotenv`).** Se mantiene `npm run start:local` (`node --env-file=.env`). Con `dotenv`, `npm start` en e2e tomaria las variables de Auth0 del `.env` local y las pruebas se romperian solo en este equipo. Por eso el comando `node server.js` del laboratorio se documenta como `npm run start:local`.

**Arranque en dos fases solo con `require.main === module`.** `boot()` carga Vault y comprueba con Auth0 antes de `http.listen`; las pruebas que importan `server.js` no lo ejecutan. Las funciones leen el entorno al llamarse, asi una prueba puede activar Auth0 definiendo variables.

**Sesion sin estado: el ID token en cookie `HttpOnly`.** Sobrevive a redespliegues, que el paso de retiro de la variable exige comprobar, y no requiere almacenamiento. Alternativa: sesion en servidor, que necesitaria una base.

**Telemetria:** ignorar `/auth/callback` en la instrumentacion HTTP para no exportar `code` y `state`, y no agregar `chat.nombre` al log cuando Auth0 esta activo. Sentry ya tiene `sendDefaultPii: false`, que excluye cookies; ademas un `beforeSend` quita la query de `/auth/callback`.

**Pruebas sin red real.** Las unitarias inyectan `query` en `loadAuth0ClientSecret` y sustituyen `fetch` para la comprobacion contra Auth0. Las de integracion activan Auth0 por entorno en un archivo propio y cubren 401, 302, cookies y socket rechazado. La sesion valida se prueba con un JWKS local si `express-oauth2-jwt-bearer` permite interceptar su descarga; si no, ese escenario se verifica con el login real y se indica en `tasks.md`.

## Risks / Trade-offs

- [El token sigue valido tras rotar el secreto] Rotar no cierra sesiones: el ID token vive hasta `exp`. Si la credencial se robo, revocar tambien las sesiones en Auth0. Es el comportamiento que el laboratorio espera en el paso de retiro.
- [Socket abierto tras vencer o cerrar sesion] La sesion solo se comprueba al conectar. Se acepta para este alcance.
- [Ventana de rotacion] Entre rotar en Auth0 y reiniciar, el proceso en marcha conserva el valor anterior y los logins nuevos fallan con `invalid_client`. Actualizar Vault y redesplegar de inmediato.
- [Fallo de arranque con Vault caido] Es intencional. En Render, un despliegue que no abre el puerto falla y sigue activa la version anterior.
- [Render solo tiene IPv4] El host directo de Supabase puede fallar con `ENETUNREACH`. Usar el session pooler, cuyo usuario lleva `.PROJECT_REF`.
- [`verifyToken` usa `req`/`res` simulados] Depende de lo que el middleware lee del request. Una prueba cubre el caso negativo, y fijar la version con el lockfile limita el riesgo.
- [Dependencias nuevas] Si `npm audit` no queda en 0, se evalua `overrides` antes de integrar.
- [`artillery/carga.yml` contra Auth0 activo] Responde 401. La carga se sigue ejecutando contra Docker local, sin Auth0.

## Migration Plan

1. Crear secreto, rol y permisos en Supabase; configurar Auth0.
2. Probar en local con `npm run start:local`.
3. Definir las variables en Render **antes** de integrar: si `AUTH0_*` existen y falta `VAULT_DATABASE_URL`, el servicio no arranca.
4. Integrar por PR a `main`; `deploy.yml` despliega si CI pasa.
5. Primer login, retirar `AUTH0_CLIENT_SECRET` si existe y rotar.

Rollback: borrar `AUTH0_DOMAIN` y `AUTH0_CLIENT_ID` en Render deja el chat abierto sin tocar el codigo; revertir el PR elimina todo el cambio.

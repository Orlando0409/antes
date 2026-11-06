# Laboratorio 8: Client Secret de Auth0 en Supabase Vault

El codigo ya esta en este repositorio. Estos son los pasos manuales con credenciales reales.

**Mantener fuera de Git, logs y capturas:** el Client Secret, la contrasena del rol y `VAULT_DATABASE_URL` completa. Si se expone alguna, cambiarla y repetir la evidencia.

## 1. Vault

1. Supabase → proyecto de prueba → anotar referencia y region.
2. Auth0 → aplicacion → copiar el Client Secret.
3. Integrations → Vault → crear secreto con nombre exacto `una_chat_auth0_client_secret`.

Evidencia: fila con el nombre y el valor oculto.

## 2. Permisos

En el SQL Editor, en consultas separadas:

```sql
-- Usar una contrasena larga y SOLO letras y numeros evita codificarla en la URI.
-- Ejecutar una vez y borrar del editor. No capturar.
create role una_chat_backend login password 'replace-with-a-long-password';
```

1. Ejecutar `sql/una_chat_vault_access.sql` completo.
2. Ejecutar `sql/check_vault_privileges.sql`: solo `backend_execute` debe dar `true`.
3. Probar el bloqueo, un bloque a la vez. Cada `select` debe dar `42501`:

```sql
set role anon;
select una_chat_private.get_auth0_client_secret();
reset role;

set role authenticated;
select una_chat_private.get_auth0_client_secret();
reset role;

set role anon;
select name from vault.decrypted_secrets;
reset role;
```

4. Comprobar la lectura del servidor (ejecutar el bloque completo; `secret_length` debe ser mayor que 16):

```sql
grant una_chat_backend to current_user;
set role una_chat_backend;
select length(una_chat_private.get_auth0_client_secret()) as secret_length;
reset role;
revoke una_chat_backend from current_user;
```

5. Verificar que se devolvio el permiso (debe dar `false`):

```sql
select pg_has_role(current_user, 'una_chat_backend', 'member') as dashboard_is_member;
```

Evidencia: booleanos, los `42501`, `secret_length` y `dashboard_is_member = false`.

## 3. Auth0

1. Settings → Application Type: **Regular Web Application**.
2. Credentials → **Client Secret (Post)**.
3. URLs, reemplazando `TU-SERVICIO`:
   - Allowed Callback URLs: `http://localhost:3000/auth/callback, http://127.0.0.1:3000/auth/callback, https://TU-SERVICIO.onrender.com/auth/callback`
   - Allowed Logout URLs y Allowed Web Origins: `http://localhost:3000, http://127.0.0.1:3000, https://TU-SERVICIO.onrender.com`

El servidor vuelve a la pagina con `/` al cerrar sesion: si Auth0 rechaza el logout, agregar tambien cada origen con barra final en Allowed Logout URLs.

Evidencia: tipo, metodo y callbacks, con el secreto oculto.

## 4. Prueba local

`cp .env.example .env` y completar `AUTH0_DOMAIN` (sin `https://`), `AUTH0_CLIENT_ID`, `APP_BASE_URL=http://localhost:3000` y `VAULT_DATABASE_URL`.

```bash
npm run start:local
```

Este repositorio no carga `.env` con `node server.js`, de modo que `npm start` y las pruebas siguen sin Auth0. `start:local` es el equivalente del comando del enunciado.

| Mensaje | Que revisar |
|---|---|
| `listening on *:3000` | Correcto: Vault entrego el secreto y Auth0 respondio `invalid_grant` a la prueba de arranque |
| `Auth0 rejected the client secret.` | Vault no tiene el secreto de esta aplicacion (`invalid_client`) |
| `The database role cannot execute ...` | El script de permisos no corrio en este proyecto |
| `Vault login failed ...` | Usuario o contrasena; en el pooler el usuario lleva `.PROJECT_REF` |
| `Supabase Vault is unreachable.` | Host; si tu red no tiene IPv6, usar el session pooler |
| `The Vault connection certificate ...` | `server/supabase-root-2021-ca.pem` |
| `Auth0 needs a valid APP_BASE_URL ...` | URL HTTPS sin barra final, o `http://localhost` |

Entrar por la misma direccion de `APP_BASE_URL` (`localhost`, no `127.0.0.1`): la cookie depende del host.

## 5. Render

**Definir las variables antes de integrar el PR.** Con `AUTH0_*` y sin `VAULT_DATABASE_URL`, el servicio no arranca (Render mantiene activa la version anterior).

Environment: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `VAULT_DATABASE_URL` y `APP_BASE_URL=https://TU-SERVICIO.onrender.com`, sin barra final. En Render usar la URI del **session pooler** (IPv4), cuyo usuario es `una_chat_backend.PROJECT_REF`.

Este proyecto despliega desde `main`: la rama `feature/vault-auth0-lab8` llega a Render al integrar su PR, cuando `deploy.yml` pasa las pruebas.

Evidencia: variables enmascaradas y Live con el commit desplegado.

## 6. Verificar y entrar

```bash
BASE=https://TU-SERVICIO.onrender.com
curl -i "$BASE/auth/config"     # 200, enabled true, dominio y Client ID, sin secreto
curl -i "$BASE/sala"            # 401
curl -i "$BASE/auth/login"      # 302 a tu dominio de Auth0
```

En una ventana privada, abrir el chat e iniciar sesion. Deben verse el nombre y el boton **Cerrar sesión**.

Evidencia: sesion abierta (se puede tapar el correo).

## 7. Retirar la variable anterior

Si existe `AUTH0_CLIENT_SECRET` en Render: Environment → Edit → eliminarla → Save and deploy. En este proyecto nunca se uso, asi que probablemente no exista: anotarlo en la bitacora y capturar igual la lista final.

Para tener el despliegue posterior si no hubo cambio: Manual Deploy. Con Live, recargar el chat (la sesion sigue) y repetir `curl -i "$BASE/sala"` sin cookie (401).

Evidencia: lista final de variables y despliegue Live.

## 8. Rotacion

**Copiar el secreto actual antes de rotar:** Auth0 lo invalida y ya no se puede volver a ver. Guardar ambos valores en archivos temporales **fuera del repositorio** (`anterior.txt`, `nuevo.txt`) y borrarlos al terminar.

1. Auth0 → Credentials → rotar el secreto. Desde aqui los logins fallan hasta el paso 4.
2. En el SQL Editor, ejecutar y copiar el id:

```sql
select id from vault.secrets where name = 'una_chat_auth0_client_secret';
```

3. Actualizar, confirmar Success y **borrar el editor sin capturarlo**:

```sql
select vault.update_secret('UUID-DEL-PASO-ANTERIOR'::uuid, 'PEGA-AQUI-EL-SECRETO-NUEVO');
```

4. Redesplegar: Actions → Desplegar chat en Render → Run workflow, o Manual Deploy. El secreto se lee solo al arrancar.
5. Con Live, iniciar sesion en otra ventana privada: debe llegar a la sala.

Rotar no cierra sesiones abiertas: el ID token sigue valido hasta vencer. Si la credencial se hubiera robado de verdad, revocar tambien las sesiones en Auth0.

Comparar ambos secretos. El comando lee el valor del archivo para que no quede en el historial del shell:

```bash
DOMINIO=TU_DOMINIO.auth0.com
CLIENT_ID=TU_CLIENT_ID
for archivo in anterior.txt nuevo.txt; do
  date +%H:%M:%S
  curl -s -w '\nHTTP %{http_code}\n' -X POST "https://$DOMINIO/oauth/token" \
    --data-urlencode "grant_type=authorization_code" \
    --data-urlencode "client_id=$CLIENT_ID" \
    --data-urlencode "client_secret@$archivo" \
    --data-urlencode "code=vault-startup-probe" \
    --data-urlencode "redirect_uri=https://TU-SERVICIO.onrender.com/auth/callback" \
    --data-urlencode "code_verifier=cadenaDePruebaDeCuarentaYTresCaracteresOMas1"
done
```

Esperado: `anterior.txt` → `invalid_client`; `nuevo.txt` → `invalid_grant` (Auth0 acepta la credencial y rechaza el codigo falso). Los archivos no deben terminar en salto de linea: crearlos con `printf '%s' 'valor' > nuevo.txt`.

Si el login falla despues de rotar: confirmar que Vault tiene el valor nuevo y redesplegar.

## Bitacora

Antes de entregar, revisar que todos los valores sensibles esten ocultos.

| Etapa | Hora | Resultado | Evidencia |
|---|---|---|---|
| Vault | | Secreto creado | Fila con nombre y valor oculto |
| Permisos | | Solo `backend_execute` en `true`; `42501` con `anon` y `authenticated`; `secret_length` = ; `dashboard_is_member` = `false` | Capturas o nota |
| Auth0 | | Regular Web Application, Client Secret (Post), callbacks | Captura |
| Render y login | | Live con commit ; sesion abierta | Variables enmascaradas, Live, sala |
| Retiro de la variable | | `AUTH0_CLIENT_SECRET` ausente; `/sala` sin cookie = 401 | Lista de variables, Live |
| Rotacion | | Ver tabla | Respuestas de ambos intentos, login nuevo |

| Intento | Hora | HTTP | `error` |
|---|---|---|---|
| Secreto anterior | | | `invalid_client` |
| Secreto nuevo | | | `invalid_grant` |
| Login nuevo | | | Llego a la sala: si / no |

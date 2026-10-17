# AGENTS.md

Guia para agentes de IA (Claude Code, Codex, Copilot, Cursor, etc.) y personas que trabajan en este repo.

## Proyecto

UNA Chat: chat en tiempo real con Express + Socket.IO. Los usuarios pueden pegar URLs de imagenes, videos o YouTube y se muestran integrados. Es un proyecto del curso de Seguridad Informatica: **la validacion anti-XSS es el requisito central**.

| Ruta | Que es |
|---|---|
| `server.js` | Backend. Sirve `index.html` en `GET /` y recibe mensajes por el evento Socket.IO `Evento-Mensaje-Server`. Exporta `{ app, http, io }`; solo hace `listen` si se ejecuta directo. |
| `libs/unalib.js` | una-lib. `validateMessage` es la unica puerta de entrada de datos de usuario. |
| `index.html` | Frontend. Inserta los mensajes con `.html()`, por eso **todo** debe venir saneado del backend. |
| `openspec/specs/` | Fuente de verdad del comportamiento (OpenSpec). |
| `test/` | Unitarias BDD (mocha + chai `expect`): `describe` Funcionalidad > `context` Dado > `context` Cuando > `it` Entonces. |
| `tests/integration/` | Integracion backend + una-lib (jest + supertest + socket.io-client). |
| `tests/e2e/` | End-to-end (Playwright, Chromium). |

## Flujo de trabajo (spec-driven)

1. Todo cambio de comportamiento empieza como propuesta OpenSpec: `/opsx:propose "<idea>"` (o `openspec new change <nombre>`).
2. Actualizar specs delta en `openspec/changes/<cambio>/specs/` con `### Requirement:` y `#### Scenario:` (WHEN/THEN).
3. Traducir cada `#### Scenario` (WHEN/THEN) a una prueba unitaria BDD en `test/`: `context('Dado ...')` > `context('Cuando ...')` > `it('Entonces debe ...')`.
4. Implementar (`/opsx:apply`) y agregar pruebas unitarias/integracion.
5. `npm run check` debe pasar. Luego `/opsx:archive` para mover el cambio a `openspec/specs/`.

## Comandos

```bash
npm start                    # servidor en http://localhost:3000
npm test                     # unitarias BDD (mocha + chai)
npm run test:integration     # integracion (jest)
npm run test:e2e             # e2e (playwright; usa el servidor de :3000 o lo inicia)
npm run spec:validate        # valida specs OpenSpec en modo estricto
npm run security:audit       # npm audit de dependencias de produccion
npm run security:snyk        # Snyk dependencias (requiere `npx snyk auth`)
npm run security:snyk-code   # Snyk SAST del codigo
npm run check                # todo lo anterior salvo e2e y snyk
```

## Reglas obligatorias

- **Nunca** insertar datos de usuario en HTML sin pasar por `validateMessage`. No quitar `removeMaliciousCode`, `removeDisallowedUrls` ni `escapeHtml`.
- Las URLs que se convierten en `<img>`/`<video>`/`<iframe>` deben validarse con regex anclado (`^...$`) **y** `is_safe_http_url` (parser `URL`). No aceptar `.svg`, credenciales, ni protocolos distintos de http/https.
- Todo bypass de XSS encontrado se agrega primero como prueba que falla (unitaria BDD + integracion) y despues se corrige.
- No agregar dependencias de produccion sin justificarlo; versiones con `^`, nunca `*`. `npm run security:audit` debe quedar en 0.
- No hacer `listen` al importar `server.js`; las pruebas levantan el servidor en el puerto 0 y lo cierran con `io.close()`.
- Mantener el estilo existente: CommonJS, `var` en `unalib.js`, comentarios cortos en espanol.
- Commits en formato Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`). Trabajar en ramas; `main` solo recibe PRs con CI en verde.

## Notas del entorno

- Node 26: mocha debe ser v11+ (v10 falla con `require is not defined in ES module scope`).
- Chromium de Playwright no trae H.264: en e2e usar videos `.webm`.
- Cada suite tiene su carpeta y no debe tomar archivos de otra:
  - mocha (`.mocharc.js`): solo `test/`.
  - jest (`package.json` > `jest`): `testMatch` en `tests/**/*.test.js` y `testPathIgnorePatterns` excluye `tests/e2e/` y `test/`.
  - playwright (`playwright.config.js`): `testDir: tests/e2e`, `testMatch: **/*.spec.js`.

# UNA Chat

Chat en tiempo real (Express + Socket.IO) del curso de Seguridad Informatica, UNA. Permite compartir imagenes, videos y YouTube pegando la URL, con validacion contra inyeccion de scripts (XSS) en `libs/unalib.js`.

## Uso

```bash
npm install
npm start          # http://localhost:3000
```

## Calidad y seguridad

| Capa | Herramienta | Comando |
|---|---|---|
| Especificacion | OpenSpec (`openspec/specs/`) | `npm run spec:validate` |
| Unitarias BDD | Mocha + Chai `expect`, Dado/Cuando/Entonces (`test/`) | `npm test` |
| Integracion | Jest + Supertest + socket.io-client | `npm run test:integration` |
| End-to-end | Playwright (Chromium) | `npm run test:e2e` |
| Dependencias | npm audit / Snyk | `npm run security:audit` / `npm run security:snyk` |
| Codigo (SAST) | Snyk Code | `npm run security:snyk-code` |

`npm run check` corre specs, audit, unitarias e integracion. GitHub Actions (`.github/workflows/ci.yml`) corre todo en cada PR.

### Snyk

1. `npx snyk auth` (abre el navegador para iniciar sesion).
2. `npm run security:snyk` y `npm run security:snyk-code`.
3. Para CI: crear el secret `SNYK_TOKEN` en GitHub (Settings > Secrets and variables > Actions).

## Agentes de IA

Ver [AGENTS.md](AGENTS.md). Flujo spec-driven con OpenSpec: `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

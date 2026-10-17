## Que cambia

<!-- Resumen corto. Enlace al cambio OpenSpec: openspec/changes/<nombre>/ -->

## Checklist

- [ ] Spec OpenSpec creada/actualizada (`npm run spec:validate`)
- [ ] Pruebas unitarias BDD (Dado/Cuando/Entonces) en `test/` (`npm test`)
- [ ] Pruebas de integracion (`npm run test:integration`)
- [ ] E2E si cambia el chat en el navegador (`npm run test:e2e`)
- [ ] Ningun dato de usuario llega al HTML sin `validateMessage`
- [ ] `npm run security:audit` en 0 y Snyk sin hallazgos high/critical

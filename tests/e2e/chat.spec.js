// @ts-check
// Pruebas End-to-End de UNA Chat (frontend + backend reales)
// Ejecutar con el servidor activo (npm start):
//   npx playwright test --project=chromium --headed

const { test, expect } = require('@playwright/test');

// medios de prueba estables (MDN, licencia CC0)
const IMAGEN_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-images/grapefruit-slice-332-332.jpg';
// webm: Chromium de Playwright no incluye el codec H.264 de los .mp4
const VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm';

// envia un mensaje desde el formulario real y devuelve el <li> de ese mensaje
async function enviarMensaje(page, nombre, mensaje) {
  await page.getByRole('textbox', { name: 'Username' }).fill(nombre);
  await page.getByRole('textbox', { name: /Escriba un mensaje/ }).fill(mensaje);
  await page.getByRole('button', { name: 'Send' }).click();

  // el nombre es unico por prueba, asi se ubica el mensaje que volvio del backend
  const item = page.getByRole('listitem').filter({ hasText: nombre });
  await expect(item).toBeVisible();
  return item;
}

// nombre unico para no confundir mensajes difundidos por otros clientes
function nombreUnico(prefijo) {
  return prefijo + '-' + Date.now();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Chat Socket.IO UNA');
});


test('el chat se comunica con el backend (texto)', async ({ page }) => {
  const nombre = nombreUnico('texto');
  const item = await enviarMensaje(page, nombre, 'Hola desde Playwright');

  await expect(item).toHaveText(nombre + ': Hola desde Playwright');
  // el campo de mensaje se limpia despues de enviar
  await expect(page.getByRole('textbox', { name: /Escriba un mensaje/ })).toHaveValue('');
});


test('URL de imagen: la imagen se muestra y termina de cargar', async ({ page }) => {
  const nombre = nombreUnico('imagen');
  const item = await enviarMensaje(page, nombre, IMAGEN_URL);

  const imagen = item.getByRole('img');
  await expect(imagen).toBeVisible();
  await expect(imagen).toHaveAttribute('src', IMAGEN_URL);

  // termino de cargar: complete = true y tiene dimensiones reales
  await expect.poll(() => imagen.evaluate((img) => img.complete && img.naturalWidth > 0), {
    message: 'la imagen no termino de cargar',
    timeout: 15000,
  }).toBe(true);

  // la URL no se muestra como texto plano
  await expect(item).not.toContainText(IMAGEN_URL);
});


test('URL de video: el reproductor aparece y carga el contenido', async ({ page }) => {
  const nombre = nombreUnico('video');
  const item = await enviarMensaje(page, nombre, VIDEO_URL);

  const video = item.locator('video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('src', VIDEO_URL);
  await expect(video).toHaveAttribute('controls', '');

  // cargo el contenido: readyState >= HAVE_CURRENT_DATA (2), sin error y con duracion
  await expect.poll(() => video.evaluate((v) => v.readyState >= 2 && !v.error && v.duration > 0), {
    message: 'el video no cargo el contenido',
    timeout: 15000,
  }).toBe(true);
});


test.describe('inyeccion de scripts', () => {

  const payloads = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
  ];

  for (const payload of payloads) {
    test('bloquea: ' + payload, async ({ page }) => {
      // registrar el listener ANTES de enviar: cualquier alert hace fallar la prueba
      const dialogos = [];
      page.on('dialog', async (dialog) => {
        dialogos.push(dialog.type() + ': ' + dialog.message());
        await dialog.dismiss();
      });

      const nombre = nombreUnico('xss');
      const item = await enviarMensaje(page, nombre, payload);

      // margen para que se disparen handlers asincronos (onerror, onload)
      await page.waitForTimeout(1000);
      expect(dialogos, 'se ejecuto un alert: ' + dialogos.join(', ')).toEqual([]);

      // saneamiento: el mensaje no trae etiquetas ni elementos inyectados
      await expect(item.locator('script, img, svg, iframe')).toHaveCount(0);
      const html = await item.innerHTML();
      expect(html).not.toMatch(/<script|onerror|onload|<svg/i);
      // el resultado mostrado es solo texto saneado
      await expect(item).toHaveText(new RegExp('^' + nombre + ': (alert\\(\'XSS\'\\))?$'));
    });
  }

  test('script en el nombre de usuario tampoco se ejecuta', async ({ page }) => {
    const dialogos = [];
    page.on('dialog', async (dialog) => {
      dialogos.push(dialog.message());
      await dialog.dismiss();
    });

    const marca = nombreUnico('nom');
    await page.getByRole('textbox', { name: 'Username' }).fill("<img src=x onerror=alert('XSS')>" + marca);
    await page.getByRole('textbox', { name: /Escriba un mensaje/ }).fill('hola');
    await page.getByRole('button', { name: 'Send' }).click();

    const item = page.getByRole('listitem').filter({ hasText: marca });
    await expect(item).toBeVisible();
    await page.waitForTimeout(1000);

    expect(dialogos).toEqual([]);
    await expect(item.locator('img')).toHaveCount(0);
    await expect(item).toHaveText(marca + ': hola');
  });

  test('URL no permitida se reemplaza', async ({ page }) => {
    const nombre = nombreUnico('url');
    const item = await enviarMensaje(page, nombre, 'vean http://malo.com/phish');

    await expect(item).toHaveText(nombre + ': vean [URL no permitida]');
    await expect(item.getByRole('link')).toHaveCount(0);
  });

});


// simula las respuestas de Auth0: el servidor de pruebas corre sin Auth0
async function simularSesion(page, sala) {
  await page.route('**/auth/config', (route) => route.fulfill({
    json: { enabled: true, domain: 'prueba.auth0.test', clientId: 'client-id' }
  }));
  await page.route('**/sala', (route) => route.fulfill(sala));
}

test.describe('inicio de sesion', () => {

  test('sin Auth0: campo de nombre visible y sin controles de sesion', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeHidden();
  });

  test('con Auth0 y sin sesion: pide iniciar sesion y no muestra el chat', async ({ page }) => {
    const sockets = [];
    page.on('request', (r) => { if (r.url().includes('/socket.io/')) sockets.push(r.url()); });
    await simularSesion(page, { status: 401, json: { error: 'Debes iniciar sesión.' } });
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeHidden();
    expect(sockets).toHaveLength(0);
  });

  test('con Auth0 y error del callback: explica y ofrece reintentar', async ({ page }) => {
    await simularSesion(page, { status: 401, json: { error: 'Debes iniciar sesión.' } });
    await page.goto('/?error=access_denied');

    await expect(page.getByRole('alert')).toContainText('Cancelaste');
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('con sesion: muestra el nombre como texto, Cerrar sesion y conecta', async ({ page }) => {
    const nombre = '<img src=x onerror=window.xss=1>Ana';
    await simularSesion(page, { status: 200, json: { name: nombre } });
    await page.goto('/');

    await expect(page.locator('#usuario')).toHaveText(nombre);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Username' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    await expect(page.locator('#usuario img')).toHaveCount(0);
    expect(await page.evaluate(() => window.xss)).toBeUndefined();
  });

});

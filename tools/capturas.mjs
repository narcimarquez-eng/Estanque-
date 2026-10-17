// Abre la escena en un navegador sin ventana y guarda capturas en ./capturas.
// Se ejecuta en GitHub Actions (ver .github/workflows/capturas.yml).
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require('../.capturas/node_modules/playwright');

const PAGE_URL = process.env.PAGE_URL || 'http://127.0.0.1:8080/index.html';
const OUT = 'capturas';
mkdirSync(OUT, { recursive: true });

const informe = [];
const anotar = (linea) => { informe.push(linea); console.log(linea); };
const esperar = (page, ms) => page.waitForTimeout(ms);

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});

async function abrir(nombre, opciones) {
  const ctx = await browser.newContext(opciones);
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000); // el renderizado por software es lento al principio
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') anotar(`[${nombre}] consola ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => anotar(`[${nombre}] ERROR de página: ${e.message}`));
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 120000 });
  await esperar(page, 15000); // tiempo para cargar texturas y generar la escena
  return page;
}

async function captura(page, nombre, texto) {
  await page.screenshot({ path: `${OUT}/${nombre}.png` });
  anotar(`OK ${nombre}: ${texto}`);
}

try {
  // ---- Móvil (390 x 844) ----
  const movil = await abrir('movil', {
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  });
  await captura(movil, 'movil-1-vista-inicial', 'vista inicial, tarde');

  const fps = await movil.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const t0 = performance.now();
    const frame = () => {
      n++;
      if (performance.now() - t0 < 3000) requestAnimationFrame(frame);
      else resolve(n / 3);
    };
    requestAnimationFrame(frame);
  }));
  anotar(`FPS aproximados en este servidor (renderizado por software, no es un móvil real): ${fps.toFixed(1)}`);

  await movil.keyboard.press('KeyC');
  await esperar(movil, 3000);
  await captura(movil, 'movil-2-vista-2', 'segunda cámara');

  await movil.keyboard.press('KeyC');
  await esperar(movil, 3000);
  await captura(movil, 'movil-3-vista-3', 'tercera cámara');

  await movil.click('[data-time="3"]');
  await esperar(movil, 3000);
  await captura(movil, 'movil-4-hora-dorada', 'hora dorada');

  await movil.click('[data-time="4"]');
  await esperar(movil, 3000);
  await captura(movil, 'movil-5-hora-azul', 'hora azul');

  // Botón ↑ del panel del móvil, mantenido 2,5 s
  const botonSubir = movil.locator('[data-key="Space"]');
  await botonSubir.dispatchEvent('pointerdown');
  await esperar(movil, 2500);
  await botonSubir.dispatchEvent('pointerup');
  await captura(movil, 'movil-6-boton-subir', 'tras mantener el botón ↑ 2,5 s');

  // Vista del pueblo, de día (quinta cámara)
  await movil.click('[data-time="2"]');
  await esperar(movil, 2000);
  await movil.keyboard.press('KeyC'); // de la tercera cámara a la del pueblo
  await esperar(movil, 4000);
  await captura(movil, 'movil-9-pueblo', 'vista del pueblo, la cascada y las fuentes');

  // Teclado (en la misma página): Espacio sube y la flecha arriba avanza
  await movil.evaluate(() => document.activeElement && document.activeElement.blur());
  await movil.keyboard.down('Space');
  await esperar(movil, 3000);
  await movil.keyboard.up('Space');
  await captura(movil, 'movil-7-espacio-subir', 'tras mantener Espacio 3 s (debe subir)');

  await movil.keyboard.down('ArrowUp');
  await esperar(movil, 3000);
  await movil.keyboard.up('ArrowUp');
  await captura(movil, 'movil-8-flecha-avanzar', 'tras mantener la flecha arriba 3 s');
  await movil.close();

  // ---- Vistas de cerca: el agua del estanque y la de la aldea, una junto a otra ----
  // Solo para estas pruebas: el gancho se inyecta al servir la página y coloca la cámara en un punto fijo.
  const GANCHO = 'window.__dbg = { noSolids: true, setPose(p, l) { camPos.set(p[0], p[1], p[2]); const dx = l[0] - p[0], dy = l[1] - p[1], dz = l[2] - p[2]; yaw = Math.atan2(-dx, -dz); pitch = Math.atan2(dy, Math.hypot(dx, dz)); } };';
  const cerca = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  });
  const pc = await cerca.newPage();
  pc.setDefaultTimeout(240000);
  pc.on('pageerror', (e) => anotar(`[cerca] ERROR de página: ${e.message}`));
  await pc.route('**/index.html', async (route) => {
    const r = await route.fetch();
    let body = await r.text();
    body = body
      .replace('if (camPos.y < 5.5) {', 'if (camPos.y < 5.5 && !(window.__dbg && window.__dbg.noSolids)) {')
      .replace('const rc = THREE.MathUtils.clamp(r, 5.2, enPueblo ? 40 : 20);', 'const rc = (window.__dbg && window.__dbg.noSolids) ? r : THREE.MathUtils.clamp(r, 5.2, enPueblo ? 40 : 20);')
      .replace(/<\/script>\s*<\/body>/, GANCHO + '\n</script>\n</body>');
    await route.fulfill({ response: r, body });
  });
  await pc.goto(PAGE_URL, { waitUntil: 'load', timeout: 120000 });
  await esperar(pc, 15000);

  const POSES = [
    ['cerca-1-estanque', 'estanque de cerca, referencia', [0.8, 1.0, 7.5], [0, 0.0, 0]],
    ['cerca-2-riachuelo', 'riachuelo de cerca, desde el norte de la valla', [-2.0, 1.5, -20], [-2.6, 0, -15]],
    ['cerca-3-cascada', 'poza de la cascada y fuentes', [0, 2.0, -24], [0, 0.8, -33]],
    ['cerca-6-base-cascada', 'base de la cascada, salpicaduras', [-3.5, 1.4, -30.5], [0, 1.2, -35.5]],
    ['cerca-7-cima-cascada', 'cima de la roca, el río antes de caer', [-2.5, 6.8, -28.5], [0, 4.9, -38]],
    ['cerca-8-rio-loma', 'río que baja por la loma hacia la cascada', [-9, 5.5, -29], [-3, 7.5, -50]],
    ['cerca-4-fuente-oeste', 'fuente del oeste de cerca', [-9, 1.8, -16], [-9, 0.8, -21]],
    ['cerca-5-fuente-este', 'fuente del este de cerca', [7, 1.8, -18], [7, 0.8, -24]],
  ];
  for (const [nombre, texto, p, l] of POSES) {
    await pc.evaluate(([pp, ll]) => window.__dbg.setPose(pp, ll), [p, l]);
    await esperar(pc, 6000);
    await captura(pc, nombre, texto);
  }
  await cerca.close();
} catch (e) {
  anotar(`ERROR en las pruebas: ${e.message}`);
  console.log(`::error::${String(e.message).split('\n')[0]}`);
  process.exitCode = 1;
} finally {
  writeFileSync(`${OUT}/informe.txt`, informe.join('\n') + '\n');
  for (const linea of informe.slice(0, 40)) {
    console.log(`::notice::${linea.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  await browser.close();
}

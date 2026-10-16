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

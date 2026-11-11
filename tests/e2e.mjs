/*
 * Test E2E del sitio Tromb (sin dependencias).
 * Levanta un servidor estático, abre Chrome headless vía DevTools Protocol
 * y recorre la página en escritorio, tablet y celular.
 *
 * Uso:  node tests/e2e.mjs
 * Requiere Google Chrome instalado (o la variable CHROME con su ruta).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'index.html';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- Resultados ---------------- */
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };

/* ---------------- Servidor estático ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.json': 'application/json' };
const notFound = new Set();
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, url === '/' ? PAGE : url);
  try {
    if (!file.startsWith(ROOT)) throw new Error('fuera de raíz');
    const info = await stat(file);
    const body = await readFile(file);
    const range = req.headers.range;
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    if (range) { // los <video> piden rangos
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = +s, end = e ? +e : info.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return res.end(body.subarray(start, end + 1));
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes' });
    res.end(body);
  } catch {
    notFound.add(url);
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* ---------------- Chequeos estáticos ---------------- */
const html = await readFile(path.join(ROOT, PAGE), 'utf8');
const cssFiles = ['styles.css', 'visual-refresh.css'];
const css = (await Promise.all(cssFiles.map(f => readFile(path.join(ROOT, f), 'utf8')))).join('\n');

// IDs duplicados
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
check('HTML: sin IDs duplicados', !dupIds.length, dupIds.join(', '));

// Referencias locales (src/href/poster/url()) que apunten a archivos inexistentes
const refs = new Set();
for (const m of html.matchAll(/\s(?:src|href|poster)="([^"#][^"]*)"/g)) refs.add(m[1]);
for (const m of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) refs.add(m[1]);
const missing = [];
for (const r of refs) {
  if (/^(https?:|mailto:|tel:|data:)/.test(r)) continue;
  if (!existsSync(path.join(ROOT, decodeURIComponent(r.replace(/^\//, ''))))) missing.push(r);
}
check('Archivos referenciados existen (HTML + CSS)', !missing.length, missing.join(', '));

// Rutas absolutas ("/algo") se rompen en GitHub Pages (el sitio vive en /TROMB-EVENTOS-WEB/)
const absolute = [...refs].filter(r => r.startsWith('/') && !r.startsWith('//'));
check('Sin rutas absolutas (compatibles con GitHub Pages)', !absolute.length, absolute.join(', '));

// Imágenes de los sliders: data-slides + data-count
const slideSets = [...html.matchAll(/data-slides="([^"]+)" data-count="(\d+)"/g)];
const missingSlides = [];
for (const [, pattern, count] of slideSets) {
  for (let i = 1; i <= +count; i++) {
    const f = pattern.replace('{n}', String(i).padStart(2, '0'));
    if (!existsSync(path.join(ROOT, f))) missingSlides.push(f);
  }
}
check(`Fotos de los ${slideSets.length} sliders existen`, !missingSlides.length, missingSlides.join(', '));

// Elementos que se pidió quitar
for (const [label, needle] of [['Reels "Personajes que rompen el hielo"', 'reels-stage'], ['"Vivilo en Instagram"', 'Vivilo en'], ['"Scroll para entrar"', 'Scroll para entrar'], ['Texto de galería', 'tal cual se vivieron'], ['Emoji de rayo en footer', '⚡'], ['Botón "Contanos" en Por qué Tromb', 'reasons-cta']])
  check(`Quitado: ${label}`, !html.includes(needle));

// Sintaxis de los JS
for (const f of ['media.js', 'animations.js']) {
  try { new Function(await readFile(path.join(ROOT, f), 'utf8')); check(`JS sin errores de sintaxis: ${f}`, true); }
  catch (e) { check(`JS sin errores de sintaxis: ${f}`, false, e.message); }
}

/* ---------------- Chrome vía DevTools Protocol ---------------- */
const profile = mkdtempSync(path.join(tmpdir(), 'tromb-e2e-'));
const PORT = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 60 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page'); } catch {}
  if (!target) await sleep(250);
}
if (!target) { console.error('No se pudo iniciar Chrome'); process.exit(2); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let seq = 0; const pending = {}; const listeners = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
  else if (m.method) listeners.forEach(fn => fn(m));
};
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending[id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'error al evaluar');
  return r.result?.result?.value;
};

let errors = [], failed = [];
listeners.push(m => {
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) errors.push(`${m.params.entry.text} ${m.params.entry.url || ''}`);
  if (m.method === 'Network.responseReceived' && m.params.response.url.startsWith(ORIGIN) && m.params.response.status >= 400) failed.push(`${m.params.response.status} ${m.params.response.url.replace(ORIGIN, '')}`);
  if (m.method === 'Network.loadingFailed' && !m.params.canceled && m.params.errorText !== 'net::ERR_ABORTED') failed.push(`${m.params.errorText} (${m.params.type})`);
});
await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.enable');

const VIEWPORTS = [['Escritorio 1440', 1440, 900, false], ['Tablet 1024', 1024, 768, false], ['Celular 390', 390, 844, true]];

for (const [label, width, height, mobile] of VIEWPORTS) {
  errors = []; failed = [];
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url: `${ORIGIN}/` });
  await sleep(2500);
  const t = name => `[${label}] ${name}`;

  // Recorrer toda la página para disparar lazy-load, observers y animaciones
  const total = await ev('document.documentElement.scrollHeight');
  for (let y = 0; y < total; y += Math.round(height * 0.7)) { await ev(`scrollTo(0, ${y})`); await sleep(350); }
  await sleep(1200);

  check(t('Sin scroll horizontal'), await ev('document.documentElement.scrollWidth <= innerWidth'), String(await ev('document.documentElement.scrollWidth')));

  const broken = await ev(`[...document.images].filter(i => i.getAttribute('src') && i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src'))`);
  check(t('Todas las imágenes cargadas se ven (ninguna rota)'), !broken.length, broken.join(', '));

  const badAnchors = await ev(`[...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector(h))`);
  check(t('Links internos (#) apuntan a secciones existentes'), !badAnchors.length, badAnchors.join(', '));

  const shows = await ev(`[...document.querySelectorAll('.slideshow')].map(b => b.querySelectorAll('.slide.is-active').length)`);
  check(t(`Sliders de sección (${shows.length}) con exactamente 1 foto activa`), shows.length === 5 && shows.every(n => n === 1), JSON.stringify(shows));

  // El hero avanza solo
  await ev('scrollTo(0,0)');
  const heroBefore = await ev(`[...document.querySelectorAll('.hero-media .slide')].findIndex(s => s.classList.contains('is-active'))`);
  await sleep(6500);
  const heroAfter = await ev(`[...document.querySelectorAll('.hero-media .slide')].findIndex(s => s.classList.contains('is-active'))`);
  check(t('Hero: el slider avanza automáticamente'), heroAfter !== heroBefore, `${heroBefore} → ${heroAfter}`);

  // Galería principal
  await ev(`document.getElementById('fg-stage').scrollIntoView({block:'center', behavior:'instant'})`); await sleep(600);
  check(t('Galería: 31 miniaturas'), (await ev(`document.querySelectorAll('.fg-thumb').length`)) === 31);
  await ev(`document.getElementById('fg-next').click()`); await sleep(1100);
  const afterNext = await ev(`document.getElementById('fg-count').textContent`);
  await ev(`document.getElementById('fg-prev').click()`); await sleep(1100);
  const afterPrev = await ev(`document.getElementById('fg-count').textContent`);
  await ev(`document.querySelectorAll('.fg-thumb')[4].click()`); await sleep(1100);
  const afterThumb = await ev(`document.getElementById('fg-count').textContent`);
  check(t('Galería: flechas y miniaturas navegan'), afterNext.startsWith('02') && afterPrev.startsWith('01') && afterThumb.startsWith('05'), `${afterNext} · ${afterPrev} · ${afterThumb}`);
  const activeImgOk = await ev(`(() => { const i = document.querySelector('.fg-slide.is-active img'); return new Promise(r => i.complete ? r(i.naturalWidth > 0) : (i.onload = () => r(true), i.onerror = () => r(false))); })()`);
  check(t('Galería: la foto activa carga y se ve'), activeImgOk);
  await ev(`(() => { const s = document.getElementById('fg-stage'); s.focus(); s.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true})); })()`); await sleep(1100);
  check(t('Galería: navegación con teclado'), (await ev(`document.getElementById('fg-count').textContent`)).startsWith('06'));
  const fit = await ev(`getComputedStyle(document.querySelector('.fg-slide img')).objectFit`);
  check(t('Galería: fotos sin recorte (object-fit: contain)'), fit === 'contain', fit);

  // Video en el celular
  await ev(`document.getElementById('pv-device').scrollIntoView({block:'center', behavior:'instant'})`); await sleep(2500);
  const vid = await ev(`(() => { const v = document.getElementById('pv-video'); return { ready: v.readyState, src: v.currentSrc.split('/').pop(), playing: !v.paused, err: v.error && v.error.code }; })()`);
  check(t('Video: carga el archivo'), vid.ready >= 1 && !vid.err, JSON.stringify(vid));
  check(t('Video: se reproduce solo al estar visible'), vid.playing, JSON.stringify(vid));
  await ev(`document.getElementById('pv-sound').click()`); await sleep(200);
  const sound = await ev(`[document.getElementById('pv-sound').getAttribute('aria-pressed'), document.getElementById('pv-video').muted]`);
  await ev(`document.getElementById('pv-sound').click()`);
  check(t('Video: botón de sonido activa/silencia'), sound[0] === 'true' && sound[1] === false, JSON.stringify(sound));
  await ev(`document.getElementById('contacto').scrollIntoView({behavior:'instant'})`); await sleep(1500);
  check(t('Video: se pausa al salir de pantalla'), await ev(`document.getElementById('pv-video').paused`));

  // Por qué Tromb: astronautas
  await ev(`document.querySelector('.reasons-block').scrollIntoView({block:'center', behavior:'instant'})`); await sleep(2200);
  const cut = await ev(`(() => { const c = document.querySelector('.cutout--astronautas'); const r = c.getBoundingClientRect(); return { in: c.classList.contains('is-in'), op: getComputedStyle(c).opacity, z: getComputedStyle(c).zIndex, left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth }; })()`);
  check(t('Astronautas: entran y quedan visibles'), cut.in && cut.op === '1', JSON.stringify(cut));
  check(t('Astronautas: dentro de la pantalla'), cut.left >= -1 && cut.right <= cut.vw + 1, JSON.stringify(cut));
  if (!mobile) {
    const align = await ev(`Math.round(document.querySelector('.cutout--astronautas').getBoundingClientRect().bottom - document.querySelector('.reason-list').getBoundingClientRect().bottom)`);
    check(t('Astronautas: delante del título y bajados hacia la base'), cut.z === '2' && align > 0 && align <= 90, `z=${cut.z}, ${align}px bajo el punto 03`);
  }

  // Menú en celular
  if (mobile) {
    await ev('scrollTo(0,0)');
    const toggleVisible = await ev(`getComputedStyle(document.getElementById('menu-toggle')).display !== 'none'`);
    await ev(`document.getElementById('menu-toggle').click()`); await sleep(300);
    const open = await ev(`getComputedStyle(document.getElementById('main-nav')).display !== 'none' && document.getElementById('main-nav').getBoundingClientRect().height > 50`);
    check(t('Menú hamburguesa abre la navegación'), toggleVisible && open);
    await ev(`document.getElementById('menu-toggle').click()`);
  }

  // Formulario de propuesta → WhatsApp (se intercepta window.open)
  const form = await ev(`(() => {
    const f = document.getElementById('lead-form'); let opened = null;
    window.open = (u) => { opened = u; return null; };
    const emptyValid = f.checkValidity();
    f.name.value = 'Test'; f.type.value = 'Casamiento'; f.date.value = '2027-01-15'; f.zone.value = 'Palermo'; f.contact.value = 'test@test.com';
    const valid = f.checkValidity();
    f.requestSubmit();
    return { emptyValid, valid, opened, success: !document.getElementById('lead-success').hidden };
  })()`);
  check(t('Formulario: campos obligatorios validan'), form.emptyValid === false && form.valid === true);
  check(t('Formulario: abre WhatsApp con el mensaje'), form.opened?.startsWith('https://wa.me/5491134745262?text=') && decodeURIComponent(form.opened).includes('Palermo') && form.success, form.opened);

  // Newsletter (se intercepta fetch: no se envía nada real)
  const news = await ev(`(async () => {
    const f = document.getElementById('newsletter-form'); let body = null;
    window.fetch = async (u, o) => { body = o.body; return { ok: true }; };
    f.email.value = 'test@test.com'; f.consent.checked = true;
    f.requestSubmit(); await new Promise(r => setTimeout(r, 300));
    return { body, success: !document.getElementById('newsletter-success').hidden };
  })()`);
  check(t('Newsletter: envía el email y muestra confirmación'), news.success && news.body?.includes('test@test.com'), JSON.stringify(news));

  check(t('Sin errores de JavaScript en consola'), !errors.length, [...new Set(errors)].join(' | '));
  check(t('Sin recursos que fallen al cargar (404 / red)'), !failed.length, [...new Set(failed)].join(' | '));
}

/* ---------------- Favicon ---------------- */
for (const f of ['assets/logo/favicon.svg', 'favicon.ico', 'assets/logo/apple-touch-icon.png']) {
  const r = await fetch(`${ORIGIN}/${f}`);
  check(`Favicon disponible: ${f}`, r.ok);
}

/* ---------------- Reporte ---------------- */
chrome.kill(); server.close();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
const fails = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${!r.ok && r.detail ? `\n    → ${r.detail}` : ''}`);
console.log(`\n${results.length - fails.length}/${results.length} chequeos OK${notFound.size ? `\n404 en servidor: ${[...notFound].join(', ')}` : ''}`);
process.exit(fails.length ? 1 : 0);

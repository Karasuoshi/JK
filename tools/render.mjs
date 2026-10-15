// Рисует карточки в стиле Юли для рецептов без оригинальной карточки (_site/cards-auto/*.jpg)
// и вырезает фото блюда из карточки, если отдельного фото нет (_site/photos-auto/*.jpg).
// Запускается после tools/build.mjs. Нужен Playwright с Chromium.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const jobs = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'render.json'), 'utf8'));
if (!jobs.cards.length && !jobs.photos.length) { console.log('✓ Рисовать нечего'); process.exit(0); }

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/__blank') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>render</title>'); }
  const file = path.join(OUT, pathname);
  if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

// 1) фото из карточек
if (jobs.photos.length) {
  fs.mkdirSync(path.join(OUT, 'photos-auto'), { recursive: true });
  const page = await browser.newPage();
  await page.goto(base + '__blank');
  for (const j of jobs.photos) {
    const data = await page.evaluate(async ({ src, crop }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const w = Math.round(img.naturalWidth * crop.w), h = Math.round(img.naturalHeight * crop.h);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, img.naturalWidth * crop.x, img.naturalHeight * crop.y, w, h, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.88);
    }, { src: base + j.src, crop: j.crop });
    fs.writeFileSync(path.join(OUT, 'photos-auto', `${j.id}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
    console.log(`  фото ← ${j.src}`);
  }
  await page.close();
}

// 2) карточки
if (jobs.cards.length) {
  fs.mkdirSync(path.join(OUT, 'cards-auto'), { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 853, height: 1280 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  for (const id of jobs.cards) {
    await page.goto(`${base}card/${id}.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#card').screenshot({ path: path.join(OUT, 'cards-auto', `${id}.jpg`), type: 'jpeg', quality: 88 });
    console.log(`  карточка → cards-auto/${id}.jpg`);
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(`✓ Нарисовано карточек: ${jobs.cards.length}, вырезано фото: ${jobs.photos.length}`);

// Сборка сайта Julia's Kitchen: recipes/*.json → _site/
// Запуск: node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fmtQty, fmtServings, shortTime, normalize } from '../site/format.js';
import { validateAll } from './validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const SITE_URL = 'https://karasuoshi.github.io/JK/';
const SITE_NAME = "Julia's Kitchen";

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const categories = read('data/categories.json');
const dict = read('data/products.json');

const { recipes, errors, warnings } = validateAll(ROOT);
for (const w of warnings) console.warn('⚠ ' + w);
if (errors.length) {
  for (const e of errors) console.error('✖ ' + e);
  console.error(`\nСборка остановлена: ${errors.length} ошибок. Исправьте рецепты и запустите снова.`);
  process.exit(1);
}

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const keysOf = (it) => (it.key == null ? [] : Array.isArray(it.key) ? it.key : [it.key]);
const recipeKeys = (r) => [...new Set(r.ingredients.flatMap((g) => g.items.flatMap(keysOf)))];
const isBasic = (k) => dict.products[k]?.group === 'Базовое';
const catTitle = (id) => categories.find((c) => c.id === id)?.title || id;
const photoOf = (r) => r.photo || (r.card?.image ? `photos-auto/${r.id}.jpg` : 'assets/no-photo.svg');
// карточка: оригинал Юли, если есть, иначе автоматическая (рисуется tools/render.mjs)
const cardOf = (r) => r.card?.image || `cards-auto/${r.id}.jpg`;
const DEFAULT_CROP = { x: 0.49, y: 0.05, w: 0.47, h: 0.25 };

// продукты, которых нет в словаре, попадают в группу «Другое»
for (const r of recipes) for (const k of recipeKeys(r)) {
  if (dict.products[k]) continue;
  dict.products[k] = { title: k[0].toUpperCase() + k.slice(1), group: 'Другое' };
  if (!dict.groups.includes('Другое')) dict.groups.splice(dict.groups.indexOf('Базовое'), 0, 'Другое');
}
const VERSION = Date.now().toString(36);

const ICON = {
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  serve: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7v3h3"/></svg>',
  hat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 5.6 3.1A4 4 0 0 1 17 14M7 14v6h10v-6M7 17h10"/></svg>',
  pie: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="10" rx="9" ry="3.5"/><path d="M3 10v4c0 2 4 3.5 9 3.5s9-1.5 9-3.5v-4"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  basket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18l-2 10H5L3 10zM8 10l4-6 4 6M9 14v3M12 14v3M15 14v3"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

function page({ title, description, base, body, ogImage, canonical, bodyClass = '', theme = 'green' }) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f3e7d1">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="manifest" href="${base}manifest.webmanifest">
<link rel="icon" href="${base}assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${base}assets/icon-180.png">
<link rel="preload" href="${base}assets/fonts/marck-script.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${base}assets/style.css?v=${VERSION}">
</head>
<body class="${bodyClass}" data-theme="${theme}" data-base="${base}">
${body}
<script type="module" src="${base}assets/app.js?v=${VERSION}"></script>
</body>
</html>
`;
}

function header(base, active) {
  return `<header class="top">
  <a class="logo" href="${base}index.html"><span class="logo-script">Julia's Kitchen</span><span class="logo-sub">домашние рецепты Юли</span></a>
  <nav class="tabs" aria-label="Разделы">
    <a href="${base}index.html" class="${active === 'recipes' ? 'on' : ''}">Рецепты</a>
    <a href="${base}products.html" class="${active === 'products' ? 'on' : ''}">По продуктам</a>
    ${active === 'recipes' && base === '' ? `<button class="icon-btn search-toggle" aria-label="Поиск" aria-expanded="false">${ICON.search}</button>` : ''}
  </nav>
</header>`;
}

function tile(r, base, i) {
  return `<a class="tile" href="${base}r/${r.id}.html" data-id="${r.id}" data-cat="${r.category}" style="--tilt:${[-1.4, 1, -0.6, 1.3, -1, 0.7][i % 6]}deg">
  <span class="polaroid"><span class="tape"></span><img src="${base}${photoOf(r)}" alt="" loading="lazy" decoding="async"></span>
  <span class="tile-title">${esc(r.title)}</span>
  <span class="tile-meta"><span>${ICON.clock}${esc(shortTime(r.time))}</span><span>${ICON.serve}${esc(fmtServings(r.servings))}</span></span>
</a>`;
}

// ---------- index ----------
function buildIndex() {
  const base = '';
  const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  const used = categories.filter((c) => recipes.some((r) => r.category === c.id));
  const chips = [`<button class="chip on" data-cat="all">Все <b>${recipes.length}</b></button>`]
    .concat(used.map((c) => `<button class="chip" data-cat="${c.id}">${esc(c.title)} <b>${recipes.filter((r) => r.category === c.id).length}</b></button>`))
    .join('');
  const body = `${header(base, 'recipes')}
<main class="wrap">
  <div class="toolbar">
    <div class="chips" role="tablist" aria-label="Категории">${chips}</div>
  </div>
  <div class="search-box" hidden>
    <input type="search" id="q" placeholder="Название или продукт: черника, курица…" autocomplete="off">
    <button class="icon-btn search-close" aria-label="Закрыть поиск">${ICON.close}</button>
  </div>
  <h1 class="section-title" id="list-title">Все рецепты</h1>
  <div class="grid" id="grid">${sorted.map((r, i) => tile(r, base, i)).join('\n')}</div>
  <p class="empty" id="empty" hidden>Ничего не нашлось. Попробуйте другое слово или загляните <a href="products.html">в продукты</a>.</p>
</main>
${footer()}`;
  return page({
    title: `${SITE_NAME} — домашние рецепты Юли`,
    description: 'Записная книжка рецептов Юли: пироги, выпечка, горячее, салаты и закуски.',
    base, body, ogImage: SITE_URL + 'assets/og.jpg', canonical: SITE_URL, bodyClass: 'home',
  });
}

function footer() {
  const d = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });
  return `<footer class="foot"><span>${recipes.length} ${recipes.length % 10 === 1 && recipes.length % 100 !== 11 ? 'рецепт' : [2, 3, 4].includes(recipes.length % 10) && ![12, 13, 14].includes(recipes.length % 100) ? 'рецепта' : 'рецептов'} · обновлено ${d}</span></footer>`;
}

// ---------- products ----------
function buildProducts() {
  const base = '';
  const counts = {};
  for (const r of recipes) for (const k of recipeKeys(r)) counts[k] = (counts[k] || 0) + 1;
  const groups = dict.groups
    .filter((g) => g !== 'Базовое')
    .map((g) => {
      const items = Object.entries(dict.products)
        .filter(([k, p]) => p.group === g && counts[k])
        .sort((a, b) => a[1].title.localeCompare(b[1].title, 'ru'));
      if (!items.length) return '';
      return `<section class="pgroup"><h2>${esc(g)}</h2><div class="pchips">${items
        .map(([k, p]) => `<button class="pchip" data-key="${esc(k)}">${esc(p.title)} <b>${counts[k]}</b></button>`)
        .join('')}</div></section>`;
    })
    .join('');
  const body = `${header(base, 'products')}
<main class="wrap">
  <h1 class="section-title">Что есть дома?</h1>
  <p class="lead">Отметьте продукты — ниже появятся рецепты, где они есть.</p>
  <div class="picked" id="picked" hidden><span id="picked-list"></span><span class="picked-act"><button class="link-btn" id="clear">Сбросить</button><button class="go-btn" id="go">Показать</button></span></div>
  ${groups}
  <h2 class="section-title small" id="res-title" hidden></h2>
  <div class="grid" id="grid"></div>
</main>
${footer()}`;
  return page({
    title: `По продуктам — ${SITE_NAME}`,
    description: 'Подбор рецептов Юли по продуктам: отметьте, что есть дома.',
    base, body, ogImage: SITE_URL + 'assets/og.jpg', canonical: SITE_URL + 'products.html', bodyClass: 'products',
  });
}

// ---------- recipe ----------
function ingredientList(r) {
  return r.ingredients
    .map((g, gi) => `<div class="igroup">${g.group ? `<h3>${esc(g.group)}</h3>` : ''}<ul>${g.items
      .map((it, ii) => `<li class="ing" data-g="${gi}" data-i="${ii}" tabindex="0" role="checkbox" aria-checked="false">
  <span class="ing-name">${esc(it.name)}${it.note ? ` <i>${esc(it.note)}</i>` : ''}${it.optional ? ' <em class="opt">по желанию</em>' : ''}</span>
  <span class="dots"></span><span class="ing-qty"><span class="q">${esc(fmtQty(it, 1, false))}</span>${it.alt ? `<small class="alt">${esc(it.alt)}</small>` : ''}</span></li>`)
      .join('')}</ul></div>`)
    .join('');
}

function related(r) {
  const mine = new Set(recipeKeys(r).filter((k) => !isBasic(k)));
  return recipes
    .filter((x) => x.id !== r.id)
    .map((x) => {
      const shared = recipeKeys(x).filter((k) => mine.has(k) && !['мука', 'сливочное масло', 'яйцо'].includes(k)).length;
      return { x, score: shared * 2 + (x.category === r.category ? 1.5 : 0) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((s) => s.x);
}

function buildRecipe(r) {
  const base = '../';
  const keys = recipeKeys(r).filter((k) => !isBasic(k) && dict.products[k]);
  const meta = [
    r.servings && `<li>${ICON.serve}<span><b class="js-serv">${esc(fmtServings(r.servings))}</b>${r.servings.note ? `<small>${esc(r.servings.note)}</small>` : ''}</span></li>`,
    r.time && `<li>${ICON.clock}<span><b>${esc(r.time.text)}</b>${r.time.note ? `<small>${esc(r.time.note)}</small>` : ''}</span></li>`,
    r.difficulty && `<li>${ICON.hat}<span><b>${esc(r.difficulty[0].toUpperCase() + r.difficulty.slice(1))} сложность</b></span></li>`,
    r.equipment && `<li>${ICON.pie}<span><b>${esc(r.equipment)}</b></span></li>`,
  ].filter(Boolean).join('');
  const steps = r.steps
    .map((s, i) => `<li class="step" data-i="${i}"><button class="step-n" aria-label="Шаг ${i + 1}: отметить выполненным">${i + 1}</button><div class="step-body">${s.title ? `<h3>${esc(s.title)}</h3>` : ''}<p>${esc(s.text)}</p></div></li>`)
    .join('');
  const tips = r.tips?.length
    ? `<aside class="tips"><h2>${ICON.heart}${r.tips.length > 1 ? 'Советы' : 'Совет'}</h2><ul>${r.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></aside>`
    : '';
  const notes = (r.notes || [])
    .map((n, i) => `<aside class="note n${i % 2}"><h2>${esc(n.title)}</h2><ul>${n.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></aside>`)
    .join('');
  const rel = related(r);
  const card = `${base}${cardOf(r)}`;
  const body = `${header(base, 'recipes')}
<main class="recipe wrap">
  <a class="back" href="${base}index.html#${r.category}">${ICON.back}${esc(catTitle(r.category))}</a>
  <section class="hero">
    <div class="hero-text">
      <h1 class="r-title">${esc(r.title)}<span class="heart">${ICON.heart}</span></h1>
      ${r.tagline ? `<p class="tagline">${esc(r.tagline)}</p>` : ''}
      ${r.source ? `<p class="source">${esc(r.source)}</p>` : ''}
      <p class="desc">${esc(r.description)}</p>
      <ul class="meta">${meta}</ul>
    </div>
    <figure class="hero-photo">
      <span class="polaroid big"><span class="tape"></span><img src="${base}${photoOf(r)}" alt="${esc(r.title)}"></span>
      ${r.card?.sticker ? `<figcaption class="sticker">${esc(r.card.sticker)}</figcaption>` : ''}
    </figure>
  </section>

  <div class="kitchen-bar" role="toolbar" aria-label="На кухне">
    <div class="scale" aria-label="Количество">
      <button class="scale-btn" data-d="-1" aria-label="Меньше">−</button>
      <span class="scale-val" aria-live="polite">×1</span>
      <button class="scale-btn" data-d="1" aria-label="Больше">+</button>
    </div>
    <button class="kb-btn wake" aria-pressed="false" title="Экран не будет гаснуть, пока открыт рецепт">${ICON.sun}<span>Не гасить экран</span></button>
    ${card ? `<a class="kb-btn" href="${card}" target="_blank" rel="noopener">${ICON.card}<span>Карточка</span></a>` : ''}
  </div>

  <div class="cols">
    <section class="ingredients" id="ingredients">
      <h2 class="brush">Ингредиенты</h2>
      ${ingredientList(r)}
      ${r.card?.aside ? `<p class="aside">${esc(r.card.aside)}</p>` : ''}
    </section>
    <section class="method" id="steps">
      <h2 class="brush">Приготовление</h2>
      <ol class="steps">${steps}</ol>
      ${tips}${notes}
      ${r.card?.footer ? `<p class="signoff">${esc(r.card.footer)}</p>` : ''}
    </section>
  </div>

  ${keys.length ? `<section class="keys"><h2 class="section-title small">Продукты в рецепте</h2><div class="pchips">${keys
    .map((k) => `<a class="pchip" href="${base}products.html#${encodeURIComponent(k)}">${esc(dict.products[k].title)}</a>`)
    .join('')}</div></section>` : ''}

  ${rel.length ? `<section class="related"><h2 class="section-title small">Ещё попробовать</h2><div class="grid">${rel.map((x, i) => tile(x, base, i)).join('')}</div></section>` : ''}

  ${card ? `<section class="orig"><h2 class="section-title small">Карточка рецепта</h2><a href="${card}" target="_blank" rel="noopener"><img src="${card}" alt="Карточка рецепта «${esc(r.title)}»" loading="lazy"></a></section>` : ''}
</main>
<div class="timers" id="timers" aria-live="polite"></div>
<script type="application/json" id="recipe-data">${JSON.stringify({ id: r.id, servings: r.servings, ingredients: r.ingredients }).replace(/</g, '\\u003c')}</script>
${footer()}`;
  return page({
    title: `${r.title} — ${SITE_NAME}`,
    description: r.description,
    base, body, ogImage: SITE_URL + photoOf(r), canonical: `${SITE_URL}r/${r.id}.html`,
    bodyClass: 'recipe-page', theme: r.card?.theme || 'green',
  });
}


// ---------- карточка в стиле Юли (для рецептов без оригинальной карточки) ----------
function buildCard(r) {
  const base = '../';
  const hasPhoto = Boolean(r.photo || r.card?.image);
  const meta = [
    r.servings && `<li>${ICON.serve}<span>${esc(fmtServings(r.servings))}${r.servings.note ? `<small>(${esc(r.servings.note)})</small>` : ''}</span></li>`,
    r.time && `<li>${ICON.clock}<span>${esc(r.time.text)}${r.time.note ? `<small>(${esc(r.time.note)})</small>` : ''}</span></li>`,
    r.difficulty && `<li>${ICON.hat}<span>${esc(r.difficulty[0].toUpperCase() + r.difficulty.slice(1))} сложность</span></li>`,
    r.equipment && `<li>${ICON.pie}<span>${esc(r.equipment)}</span></li>`,
  ].filter(Boolean).join('');
  const ings = r.ingredients.map((g) => `<div class="c-group">${g.group ? `<h3>${esc(g.group)}${/[:)]$/.test(g.group) ? '' : ':'}</h3>` : ''}<ul>${g.items
    .map((it) => `<li><span>${esc(it.name)}${it.note ? ` (${esc(it.note)})` : ''}${it.optional ? ' (по желанию)' : ''}</span><i></i><b>${esc(fmtQty(it))}</b></li>`).join('')}</ul></div>`).join('');
  const steps = r.steps.map((st, i) => `<li><span class="c-n">${i + 1}</span><p>${st.title ? `<b>${esc(st.title)}.</b> ` : ''}${esc(st.text)}</p></li>`).join('');
  const tips = r.tips?.length ? `<aside class="c-tips"><h2>${ICON.heart}${r.tips.length > 1 ? 'Советы:' : 'Совет:'}</h2><ul>${r.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></aside>` : '';
  const notes = (r.notes || []).map((n) => `<aside class="c-note"><h2>${esc(n.title)}</h2><ul>${n.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></aside>`).join('');
  const sticker = r.card?.sticker || 'Просто. Вкусно. По-домашнему.';
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=853">
<title>${esc(r.title)} — карточка</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="${base}assets/card.css?v=${VERSION}"></head>
<body data-theme="${r.card?.theme || 'green'}">
<article class="c" id="card">
  <header class="c-head${hasPhoto ? '' : ' no-photo'}">
    <div class="c-left">
      <h1>${esc(r.title)}<span class="c-heart">${ICON.heart}</span></h1>
      ${r.tagline ? `<p class="c-tagline">${esc(r.tagline)}</p>` : ''}
      ${r.source ? `<p class="c-source">${esc(r.source)}</p>` : ''}
      <p class="c-desc">${esc(r.description)}</p>
      <ul class="c-meta">${meta}</ul>
    </div>
    ${hasPhoto ? `<figure class="c-photo"><span class="c-pol"><span class="c-tape"></span><img src="${base}${photoOf(r)}" alt=""></span><figcaption class="c-sticker">${esc(sticker)}</figcaption></figure>` : `<p class="c-sticker solo">${esc(sticker)}</p>`}
  </header>
  <div class="c-cols">
    <section class="c-ing"><h2 class="c-brush">Ингредиенты</h2>${ings}${r.card?.aside ? `<p class="c-aside">${esc(r.card.aside)}</p>` : ''}</section>
    <section class="c-steps"><h2 class="c-brush">Приготовление</h2><ol>${steps}</ol>${tips}${notes}</section>
  </div>
  ${r.card?.footer ? `<footer class="c-foot">${esc(r.card.footer)}<span class="c-heart">${ICON.heart}</span></footer>` : ''}
</article>
</body></html>
`;
}

// ---------- search index ----------
function searchIndex() {
  return recipes.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    photo: photoOf(r),
    url: `${SITE_URL}r/${r.id}.html`,
    json: `${SITE_URL}data/${r.id}.json`,
    card: SITE_URL + cardOf(r),
    added: r.added,
    time: shortTime(r.time),
    serv: fmtServings(r.servings),
    keys: recipeKeys(r),
    text: normalize([r.title, r.tagline, ...(r.tags || []), ...r.ingredients.flatMap((g) => g.items.map((i) => i.name))].join(' ')),
  }));
}

// ---------- write ----------
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'r'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'card'), { recursive: true });
copyDir(path.join(ROOT, 'site'), path.join(OUT, 'assets'));
copyDir(path.join(ROOT, 'photos'), path.join(OUT, 'photos'));
copyDir(path.join(ROOT, 'cards'), path.join(OUT, 'cards'));
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'data', 'index.json'), JSON.stringify({ categories, products: dict.products, recipes: searchIndex() }));
fs.writeFileSync(path.join(OUT, 'index.html'), buildIndex());
fs.writeFileSync(path.join(OUT, 'products.html'), buildProducts());
for (const r of recipes) {
  fs.writeFileSync(path.join(OUT, 'r', `${r.id}.html`), buildRecipe(r));
  fs.writeFileSync(path.join(OUT, 'card', `${r.id}.html`), buildCard(r));
  fs.copyFileSync(path.join(ROOT, 'recipes', `${r.id}.json`), path.join(OUT, 'data', `${r.id}.json`));
}
// задания для tools/render.mjs: какие карточки нарисовать и какие фото вырезать из карточек
const renderAll = process.env.RENDER_ALL === '1';
fs.writeFileSync(path.join(OUT, 'data', 'render.json'), JSON.stringify({
  cards: recipes.filter((r) => renderAll || !r.card?.image).map((r) => r.id),
  photos: recipes.filter((r) => !r.photo && r.card?.image).map((r) => ({ id: r.id, src: r.card.image, crop: r.card.photo_crop || DEFAULT_CROP })),
}, null, 1));
for (const f of ['AGENTS.md']) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f.toLowerCase()));
copyDir(path.join(ROOT, 'schema'), path.join(OUT, 'schema'));
fs.copyFileSync(path.join(ROOT, 'docs', 'CARD_PROMPT.md'), path.join(OUT, 'card-prompt.md'));
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: SITE_NAME, short_name: 'Кухня Юли', start_url: './index.html', scope: './', display: 'standalone',
  background_color: '#f3e7d1', theme_color: '#f3e7d1', lang: 'ru',
  icons: [{ src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 1));
const swSrc = fs.readFileSync(path.join(ROOT, 'site', 'sw.js'), 'utf8').replace('__VERSION__', VERSION);
fs.writeFileSync(path.join(OUT, 'sw.js'), swSrc);
fs.rmSync(path.join(OUT, 'assets', 'sw.js'), { force: true });
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, '404.html'), page({
  title: `Не найдено — ${SITE_NAME}`, description: 'Такой страницы нет', base: '/JK/',
  body: `${header('/JK/', '')}<main class="wrap"><h1 class="section-title">Такой страницы нет</h1><p class="lead"><a href="/JK/index.html">Все рецепты</a></p></main>`,
  ogImage: SITE_URL + 'assets/og.jpg', canonical: SITE_URL,
}));
console.log(`✓ Собрано: ${recipes.length} рецептов → _site/`);

import { fmtQty, fmtServings, normalize } from './format.js';

const base = document.body.dataset.base || '';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const SERVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7v3h3"/></svg>';

let indexPromise;
const loadIndex = () => (indexPromise ||= fetch(base + 'data/index.json').then((r) => r.json()));

function tileHTML(r, i) {
  const tilt = [-1.4, 1, -0.6, 1.3, -1, 0.7][i % 6];
  return `<a class="tile" href="${base}r/${r.id}.html" style="--tilt:${tilt}deg">
  <span class="polaroid"><span class="tape"></span><img src="${base}${r.photo || 'assets/no-photo.svg'}" alt="" loading="lazy"></span>
  <span class="tile-title">${esc(r.title)}</span>
  <span class="tile-meta"><span>${CLOCK}${esc(r.time)}</span><span>${SERVE}${esc(r.serv)}</span></span></a>`;
}

const stem = (w) => w.slice(0, Math.max(3, w.length - 2));
function matches(text, query) {
  const words = text.split(' ');
  return normalize(query).split(' ').filter(Boolean).every((q) => words.some((w) => w.startsWith(stem(q))));
}

/* ---------- главная ---------- */
function initHome() {
  const chips = $$('.chip');
  const tiles = $$('#grid .tile');
  const title = $('#list-title');
  const empty = $('#empty');
  const box = $('.search-box');
  const input = $('#q');
  let cat = 'all';
  let query = '';
  let index = null;

  function apply() {
    let shown = 0;
    for (const t of tiles) {
      let ok = cat === 'all' || t.dataset.cat === cat;
      if (ok && query && index) ok = matches(index.get(t.dataset.id) || '', query);
      t.hidden = !ok;
      if (ok) shown++;
    }
    const chip = chips.find((c) => c.dataset.cat === cat);
    title.textContent = query ? `Поиск: «${query}»` : cat === 'all' ? 'Все рецепты' : chip.firstChild.textContent.trim();
    empty.hidden = shown > 0;
  }
  function setCat(c, push = true) {
    cat = chips.some((x) => x.dataset.cat === c) ? c : 'all';
    chips.forEach((x) => x.classList.toggle('on', x.dataset.cat === cat));
    if (push) history.replaceState(null, '', cat === 'all' ? location.pathname : '#' + cat);
    apply();
  }
  chips.forEach((c) => c.addEventListener('click', () => setCat(c.dataset.cat)));
  setCat(decodeURIComponent(location.hash.slice(1)) || 'all', false);
  window.addEventListener('hashchange', () => setCat(location.hash.slice(1) || 'all', false));

  const toggle = $('.search-toggle');
  toggle.addEventListener('click', async () => {
    box.hidden = !box.hidden;
    toggle.setAttribute('aria-expanded', String(!box.hidden));
    if (!box.hidden) {
      input.focus();
      if (!index) index = new Map((await loadIndex()).recipes.map((r) => [r.id, r.text]));
    } else { query = ''; input.value = ''; apply(); }
  });
  $('.search-close').addEventListener('click', () => toggle.click());
  input.addEventListener('input', () => { query = input.value.trim(); apply(); });
}

/* ---------- по продуктам ---------- */
async function initProducts() {
  const data = await loadIndex();
  const chips = $$('.pchip');
  const grid = $('#grid');
  const resTitle = $('#res-title');
  const picked = $('#picked');
  let sel = new Set(decodeURIComponent(location.hash.slice(1)).split(',').filter(Boolean));

  function render() {
    chips.forEach((c) => c.classList.toggle('on', sel.has(c.dataset.key)));
    history.replaceState(null, '', sel.size ? '#' + [...sel].map(encodeURIComponent).join(',') : location.pathname);
    picked.hidden = !sel.size;
    $('#picked-list').textContent = [...sel].map((k) => data.products[k]?.title || k).join(', ');
    if (!sel.size) { grid.innerHTML = ''; resTitle.hidden = true; return; }
    const scored = data.recipes
      .map((r) => ({ r, n: [...sel].filter((k) => r.keys.includes(k)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.r.title.localeCompare(b.r.title, 'ru'));
    const full = scored.filter((x) => x.n === sel.size);
    const list = full.length ? full : scored;
    resTitle.hidden = false;
    resTitle.textContent = full.length
      ? (sel.size > 1 ? `Есть всё отмеченное: ${full.length}` : `Рецепты: ${full.length}`)
      : 'Вместе нигде не встречаются — вот где есть хотя бы что-то';
    grid.innerHTML = list.map((x, i) => tileHTML(x.r, i)).join('');
    $('#go').textContent = `Показать ${list.length} ↓`;
  }
  $('#go').addEventListener('click', () => resTitle.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  chips.forEach((c) => c.addEventListener('click', () => {
    const k = c.dataset.key;
    sel.has(k) ? sel.delete(k) : sel.add(k);
    render();
  }));
  $('#clear').addEventListener('click', () => { sel = new Set(); render(); });
  render();
  if (sel.size && location.hash) resTitle.scrollIntoView({ block: 'start' });
}

/* ---------- рецепт ---------- */
function initRecipe() {
  const data = JSON.parse($('#recipe-data').textContent);
  const key = 'jk-progress:' + data.id;
  const saved = store.get(key);
  const fresh = saved && Date.now() - saved.t < 12 * 3600e3;
  const state = fresh ? saved : { ing: [], steps: [], k: 1, t: Date.now() };
  const save = () => { state.t = Date.now(); store.set(key, state); };

  // отметки ингредиентов
  for (const li of $$('.ing')) {
    const id = li.dataset.g + '.' + li.dataset.i;
    const set = (on) => { li.classList.toggle('done', on); li.setAttribute('aria-checked', String(on)); };
    set(state.ing.includes(id));
    const flip = () => {
      const on = !li.classList.contains('done');
      set(on);
      state.ing = on ? [...state.ing, id] : state.ing.filter((x) => x !== id);
      save();
    };
    li.addEventListener('click', flip);
    li.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  }

  // шаги и таймеры
  const RX = /(\d+(?:,\d+)?)(?:\s*[–-]\s*(\d+(?:,\d+)?))?\s*(минут[аы]?|мин\.?|час(?:а|ов)?)(?![а-яё])/gi;
  for (const li of $$('.step')) {
    const i = Number(li.dataset.i);
    const p = $('p', li);
    p.innerHTML = esc(p.textContent).replace(RX, (m, a, b, unit) => {
      const mins = parseFloat(a.replace(',', '.')) * (/^час/i.test(unit) ? 60 : 1);
      return `<button class="timer-chip" data-min="${mins}" data-step="${i + 1}" title="Запустить таймер">${CLOCK}${m}</button>`;
    });
    li.classList.toggle('done', state.steps.includes(i));
    $('.step-n', li).addEventListener('click', () => {
      const on = li.classList.toggle('done');
      state.steps = on ? [...state.steps, i] : state.steps.filter((x) => x !== i);
      save();
    });
  }
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.timer-chip');
    if (chip) startTimer(Number(chip.dataset.min), `Шаг ${chip.dataset.step}: ${chip.textContent.trim()}`);
  });

  // пересчёт порций
  const K = [0.5, 1, 1.5, 2, 3];
  const lbl = { 0.5: '×½', 1: '×1', 1.5: '×1½', 2: '×2', 3: '×3' };
  const serv = $('.js-serv');
  function applyScale() {
    $('.scale-val').textContent = lbl[state.k];
    for (const li of $$('.ing')) {
      const it = data.ingredients[li.dataset.g].items[li.dataset.i];
      $('.q', li).textContent = fmtQty(it, state.k, false);
      const alt = $('.alt', li);
      if (alt) alt.hidden = state.k !== 1;
    }
    if (serv && data.servings) serv.textContent = fmtServings(data.servings, state.k);
  }
  $$('.scale-btn').forEach((b) => b.addEventListener('click', () => {
    const at = K.indexOf(state.k) + Number(b.dataset.d);
    if (at < 0 || at >= K.length) return;
    state.k = K[at];
    applyScale();
    save();
  }));
  if (!K.includes(state.k)) state.k = 1;
  applyScale();

  // нижняя панель уезжает, когда рецепт закончился
  const bar = $('.kitchen-bar');
  const end = $('#recipe-end');
  if (bar && end && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      bar.classList.toggle('away', e.isIntersecting || e.boundingClientRect.top < 0);
    }).observe(end);
  }

  // экран не гаснет
  const wake = $('.wake');
  let lock = null;
  let want = false;
  async function acquire() {
    try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); return true; } catch { return false; }
  }
  if (!('wakeLock' in navigator)) wake.hidden = true;
  wake.addEventListener('click', async () => {
    want = !want;
    if (want) want = await acquire();
    else if (lock) { await lock.release(); lock = null; }
    wake.setAttribute('aria-pressed', String(want));
  });
  document.addEventListener('visibilitychange', () => { if (want && !lock && document.visibilityState === 'visible') acquire(); });
}

/* ---------- таймеры ---------- */
let audio;
function beep() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, t + i * 0.45);
      g.gain.exponentialRampToValueAtTime(0.4, t + i * 0.45 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.45 + 0.35);
      o.start(t + i * 0.45); o.stop(t + i * 0.45 + 0.4);
    }
  } catch { /* без звука */ }
}
function startTimer(mins, label) {
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch { /* */ }
  const box = $('#timers');
  const end = Date.now() + mins * 60e3;
  const el = document.createElement('div');
  el.className = 'timer';
  el.innerHTML = `<div><b>--:--</b><small>${esc(label)}</small></div><button>Стоп</button>`;
  box.appendChild(el);
  let rang = false;
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const s = Math.round(left / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    $('b', el).textContent = (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
    if (!left && !rang) {
      rang = true;
      el.classList.add('ring');
      $('b', el).textContent = 'Готово!';
      $('button', el).textContent = 'ОК';
      beep();
      navigator.vibrate?.([300, 150, 300, 150, 300]);
    }
  };
  tick();
  const iv = setInterval(tick, 1000);
  $('button', el).addEventListener('click', () => { clearInterval(iv); el.remove(); });
}

/* ---------- запуск ---------- */
const cls = document.body.classList;
if (cls.contains('home')) initHome();
if (cls.contains('products')) initProducts();
if (cls.contains('recipe-page')) initRecipe();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register(base + 'sw.js').catch(() => {});
}

// Общие функции форматирования количеств. Используются и при сборке (Node), и в браузере.

const PLURALS = [
  ['порция', 'порции', 'порций'],
  ['пампушка', 'пампушки', 'пампушек'],
  ['булочка', 'булочки', 'булочек'],
  ['зубчик', 'зубчика', 'зубчиков'],
  ['штука', 'штуки', 'штук'],
  ['кусочек', 'кусочка', 'кусочков'],
  ['лепёшка', 'лепёшки', 'лепёшек'],
  ['блин', 'блина', 'блинов'],
  ['сырник', 'сырника', 'сырников'],
  ['котлета', 'котлеты', 'котлет'],
  ['пирожок', 'пирожка', 'пирожков'],
  ['шаурма', 'шаурмы', 'шаурм'],
];

function pluralForms(word) {
  const w = String(word || '').toLowerCase();
  return PLURALS.find((f) => f.includes(w));
}

export function plural(n, word) {
  const forms = pluralForms(word);
  if (!forms) return word;
  if (!Number.isInteger(n)) return forms[1];
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}

const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
const SPOONS = new Set(['ч. л.', 'ст. л.', 'стакан', 'стакана']);
const COUNTABLE = new Set(['шт.', 'зубчик', 'пучок', 'лист', 'веточка']);

function roundFor(v, unit) {
  if (SPOONS.has(unit)) return Math.max(0.25, Math.round(v * 4) / 4);
  if (COUNTABLE.has(unit)) return Math.max(0.5, Math.round(v * 2) / 2);
  if (v >= 100) return Math.round(v / 5) * 5;
  if (v >= 10) return Math.round(v);
  return Math.max(0.5, Math.round(v * 2) / 2);
}

export function fmtNum(v, unit) {
  const useFractions = SPOONS.has(unit) || COUNTABLE.has(unit) || !unit;
  const whole = Math.floor(v);
  const frac = Math.round((v - whole) * 100) / 100;
  if (useFractions && FRACTIONS[frac] !== undefined) return (whole ? whole : '') + FRACTIONS[frac];
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

export function scaleValue(q, k, unit) {
  if (k === 1) return q;
  return Array.isArray(q) ? q.map((v) => roundFor(v * k, unit)) : roundFor(q * k, unit);
}

// Количество ингредиента как строка: «300 г», «1–2 зубчика», «около 500 г», «по вкусу».
export function fmtQty(item, k = 1, withAlt = true) {
  if (item.qty === undefined || item.qty === null) return item.amount || '';
  const unit = item.unit || '';
  const q = scaleValue(item.qty, k, unit);
  const last = Array.isArray(q) ? q[q.length - 1] : q;
  const num = Array.isArray(q) ? q.map((v) => fmtNum(v, unit)).join('–') : fmtNum(q, unit);
  const u = pluralForms(unit) ? plural(last, unit) : unit;
  let s = (item.approx ? 'около ' : '') + num + (u ? ' ' + u : '');
  if (withAlt && k === 1 && item.alt) s += ` (${item.alt})`;
  return s;
}

// Выход блюда: «4 порции», «7–8 пампушек».
export function fmtServings(s, k = 1) {
  if (!s) return '';
  const q = scaleValue(s.qty, k, 'шт.');
  const last = Array.isArray(q) ? q[q.length - 1] : q;
  const num = Array.isArray(q) ? q.map((v) => fmtNum(v, 'шт.')).join('–') : fmtNum(q, 'шт.');
  const u = pluralForms(s.unit) ? plural(last, s.unit) : s.unit;
  return `${num} ${u}`;
}

export function shortTime(t) {
  if (!t || t.minutes === undefined) return t?.text || '';
  const m = Array.isArray(t.minutes) ? t.minutes[t.minutes.length - 1] : t.minutes;
  if (m < 60) return `${m} мин`;
  const h = m / 60;
  const hs = Number.isInteger(h) ? String(h) : String(Math.round(h * 2) / 2).replace('.', ',');
  return `${hs} ч`;
}

export function normalize(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Примерная калорийность рецепта из его ингредиентов и data/nutrition.json. Значения средние, не лабораторные.
const UNIT_FIELD = { 'зубчик': 'p', 'шт.': 'p', 'головка': 'head', 'листьев': 'leaf', 'ломтика': 'sl', 'кусочек': 'sl', 'кусочка': 'sl', 'кружочка': 'sl', 'стебель': 'st', 'стебля': 'st', 'веточка': 'st', 'веточки': 'st', 'упаковка': 'pack', 'пакетик': 'pack', 'банка': 'can', 'долька': 'sl', 'горошин': 'p' };
// вес готового блюда относительно сырых продуктов
const COOKED = { vypechka: 0.85, pirogi: 0.85, goryachee: 0.85, zavtraki: 0.9, zakuski: 0.95, deserty: 0.95, supy: 0.95, salaty: 1, sousy: 1, napitki: 1 };
// количество словами, у которого есть смысл в калориях
const WORDS = [[/жарк|фритюр|сковород/, 20], [/обваливан|панировк/, 30], [/горсть/, 30], [/немного/, 10], [/небольш/, 15]];
const SKIP = /вкусу|щепот|подачи|посып|варки|замачив|обмакив|капля|смазыв|желанию|весь|зонтики|веточ|лайма/;
const UNKNOWN = /не указано/;

const mean = (q) => (Array.isArray(q) ? (q[0] + q[1]) / 2 : q);

function gramsOf(it, p) {
  const q = mean(it.qty);
  const u = it.unit;
  if (u === 'г' || u === 'мл') return q;
  if (u === 'кг' || u === 'л') return q * 1000;
  if (u === 'ст. л.') return q * (p.sp ?? 15);
  if (u === 'ч. л.') return q * ((p.sp ?? 15) / 3);
  if (/^стакан/.test(u)) return q * (p.cup ?? 200);
  const field = UNIT_FIELD[u];
  return field && p[field] !== undefined ? q * p[field] : null;
}

export function nutritionOf(r, table) {
  let kcal = 0, weight = 0;
  const missing = [];
  for (const g of r.ingredients) for (const it of g.items) {
    if (it.optional) continue;
    const keys = it.key == null ? [] : Array.isArray(it.key) ? it.key : [it.key];
    let p = table[keys[0]];
    if (!keys.length) continue;
    if (/желт?к/i.test(it.name)) p = { kcal: 350, p: 18 };
    else if (/^бел(ок|ка|ки)/i.test(it.name)) p = { kcal: 48, p: 33 };
    if (!p) { missing.push(it.name); continue; }
    let grams;
    if (it.qty !== undefined) {
      grams = gramsOf(it, p);
      if (grams === null) { missing.push(it.name); continue; }
    } else {
      const a = String(it.amount || '').toLowerCase();
      const w = WORDS.find(([rx]) => rx.test(a));
      if (w) grams = w[1];
      else if (UNKNOWN.test(a) && p.kcal > 0) { missing.push(it.name); continue; }
      else continue;
    }
    kcal += (grams * p.kcal) / 100;
    weight += grams;
  }
  // рецепт неполный: цифра только запутает
  if (kcal < 20 || weight <= 0 || missing.length > 2) return null;
  const each = String(r.servings?.note || '').match(/по\s+(\d+)\s*г/);
  const cooked = r.yield_g ?? (each && r.servings ? mean(r.servings.qty) * Number(each[1]) : weight * (COOKED[r.category] ?? 0.9));
  return { kcal: Math.round(kcal), weight: Math.round(cooked), missing: [...new Set(missing)] };
}

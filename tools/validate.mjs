// Проверка рецептов. Запуск отдельно: node tools/validate.mjs
// Ошибки останавливают сборку, предупреждения — нет.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const THEMES = ['green', 'plum', 'terracotta'];
const DIFFICULTY = ['простая', 'средняя', 'сложная'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isQty = (v) => isNum(v) || (Array.isArray(v) && v.length === 2 && v.every(isNum) && v[0] < v[1]);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateAll(root) {
  const errors = [];
  const warnings = [];
  const categories = JSON.parse(fs.readFileSync(path.join(root, 'data/categories.json'), 'utf8')).map((c) => c.id);
  const dict = JSON.parse(fs.readFileSync(path.join(root, 'data/products.json'), 'utf8'));
  const dir = path.join(root, 'recipes');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const recipes = [];
  const ids = new Set();

  for (const f of files) {
    const where = `recipes/${f}`;
    const err = (m) => errors.push(`${where}: ${m}`);
    const warn = (m) => warnings.push(`${where}: ${m}`);
    let r;
    try {
      r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      err(`не читается как JSON (${e.message})`);
      continue;
    }
    const id = f.replace(/\.json$/, '');
    if (r.id !== id) err(`поле "id" должно совпадать с именем файла ("${id}")`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) err('имя файла — только латиница, цифры и дефисы, например "chernichnyy-pirog.json"');
    if (ids.has(id)) err('такой id уже есть');
    ids.add(id);
    if (!isStr(r.title)) err('нет названия "title"');
    if (!isStr(r.description)) err('нет описания "description"');
    if (!categories.includes(r.category)) err(`категория "${r.category}" не найдена. Возможные: ${categories.join(', ')}`);
    if (r.tags && !Array.isArray(r.tags)) err('"tags" должно быть списком');
    if (r.servings && !(isQty(r.servings.qty) && isStr(r.servings.unit))) err('"servings" должно быть вида {"qty": 4, "unit": "порции"}');
    if (!r.servings) warn('не указан выход ("servings") — пересчёт порций будет только множителем');
    if (r.time && !(isStr(r.time.text) && isQty(r.time.minutes))) err('"time" должно быть вида {"text": "40 минут", "minutes": 40}');
    if (r.difficulty && !DIFFICULTY.includes(r.difficulty)) err(`"difficulty" — одно из: ${DIFFICULTY.join(', ')}`);

    if (!Array.isArray(r.ingredients) || !r.ingredients.length) err('нет ингредиентов');
    else r.ingredients.forEach((g, gi) => {
      if (!Array.isArray(g.items) || !g.items.length) return err(`группа ингредиентов №${gi + 1} пустая`);
      g.items.forEach((it, ii) => {
        const at = `ингредиент «${it.name || '?'}» (группа ${gi + 1}, строка ${ii + 1})`;
        if (!isStr(it.name)) err(`${at}: нет "name"`);
        const hasQty = it.qty !== undefined;
        if (hasQty && !isQty(it.qty)) err(`${at}: "qty" — число или [от, до]`);
        if (hasQty && typeof it.unit !== 'string') err(`${at}: при "qty" нужен "unit" (г, мл, шт., ч. л., ст. л., зубчик…)`);
        if (!hasQty && !isStr(it.amount)) err(`${at}: нужен либо "qty"+"unit", либо "amount" (например "по вкусу")`);
        const keys = it.key == null ? [] : Array.isArray(it.key) ? it.key : [it.key];
        if (it.key === undefined) warn(`${at}: нет "key" — продукт не попадёт в раздел «По продуктам»`);
        for (const k of keys) if (!dict.products[k]) warn(`${at}: продукта "${k}" нет в data/products.json — он попадёт в группу «Другое»`);
      });
    });

    if (!Array.isArray(r.steps) || !r.steps.length) err('нет шагов "steps"');
    else r.steps.forEach((s, i) => { if (!isStr(s.text)) err(`шаг ${i + 1}: нет "text"`); });
    if (r.tips && !Array.isArray(r.tips)) err('"tips" должно быть списком строк');
    if (r.notes && !(Array.isArray(r.notes) && r.notes.every((n) => isStr(n.title) && Array.isArray(n.items)))) err('"notes" — список {"title", "items": [...]}');

    if (r.photo) {
      if (!fs.existsSync(path.join(root, r.photo))) err(`нет файла фото ${r.photo}`);
    } else if (!r.card?.image) warn('нет фото блюда — будет показана заглушка');
    if (r.card?.image && !fs.existsSync(path.join(root, r.card.image))) err(`нет файла карточки ${r.card.image}`);
    if (r.card?.theme && !THEMES.includes(r.card.theme)) err(`"card.theme" — одно из: ${THEMES.join(', ')}`);

    recipes.push(r);
  }
  return { recipes, errors, warnings };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { recipes, errors, warnings } = validateAll(root);
  for (const w of warnings) console.warn('⚠ ' + w);
  for (const e of errors) console.error('✖ ' + e);
  console.log(errors.length ? `\n✖ Ошибок: ${errors.length}` : `✓ Рецептов: ${recipes.length}, ошибок нет`);
  process.exit(errors.length ? 1 : 0);
}

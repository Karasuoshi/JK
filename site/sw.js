// Офлайн-режим: сайт открывается на кухне даже без интернета.
const CACHE = 'jk-__VERSION__';
const CORE = ['./', './index.html', './products.html', './data/index.json', './assets/style.css', './assets/app.js', './assets/format.js',
  './assets/fonts/marck-script.woff', './assets/fonts/caveat.woff', './assets/fonts/lora.woff', './assets/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    // заранее кладём в кэш все рецепты и фото, чтобы они открывались без сети
    try {
      const idx = await (await fetch('./data/index.json')).json();
      const urls = idx.recipes.flatMap((r) => [`./r/${r.id}.html`, r.photo ? `./${r.photo}` : null]).filter(Boolean);
      await Promise.allSettled(urls.map((u) => c.add(u)));
    } catch { /* не страшно */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || req.url.endsWith('.json');
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (isPage) {
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch {
        return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html'));
      }
    }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  })());
});

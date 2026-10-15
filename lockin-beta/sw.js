/* Lock-In service worker.
   To ship an update: change the app files, bump VERSION here and APP_VERSION in index.html. */
const VERSION = '2.0.0';
const CACHE = 'lockinbeta-' + VERSION;
const FONTS = 'lockinbeta-fonts';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './cloud.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('lockinbeta-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: serve from cache, refresh in the background
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App files: always from this version's cache, so a new version only applies after "Update"
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' }) ||
                (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) { return req.mode === 'navigate' ? (await cache.match('./')) : Response.error(); }
  })());
});

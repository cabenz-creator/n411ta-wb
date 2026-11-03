// Offline support for N411TA.
// The page itself is network-first: with signal you always get the newest version from GitHub,
// and the saved copy is used only with no connection (or a slow one, after 4 s).
// Other app files come from the saved copy and are refreshed in the background.
// Weather requests are never cached; the stencil font is.
const CACHE = 'r172e-wb-v29';
const FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './airports.js', './parts.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const keep = res => res && (res.ok || res.type === 'opaque');
function page(req) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('slow')), 4000);
    fetch(req.url, { cache: 'no-cache' }).then(res => {
      clearTimeout(t);
      if (!res.ok) { reject(new Error('HTTP ' + res.status)); return; }
      const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy));
      resolve(res);
    }, err => { clearTimeout(t); reject(err); });
  });
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !fonts) return; // weather goes straight to the network
  if (e.request.mode === 'navigate' || (url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(page(e.request).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(res => {
      if (keep(res)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => caches.match('./index.html'));
  }));
});

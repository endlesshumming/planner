/* 플래너 서비스 워커: 인터넷이 끊겨도 앱이 열리게, 마지막으로 받은 화면을 보관해요.
   화면(index.html)은 항상 인터넷에서 먼저 받아서 새 버전이 바로 반영되고, 안 될 때만 보관본을 써요. */
const CACHE = 'planner-shell-v1';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') {
    const shell = /\/(index\.html)?$/.test(new URL(r.url).pathname);
    e.respondWith(fetch(r).then(res => { if (res.ok && shell) { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./', cp)); } return res; })
      .catch(() => caches.match('./').then(m => m || caches.match(r))));
    return;
  }
  if (/\/icons\/|manifest\.webmanifest$/.test(r.url)) e.respondWith(caches.match(r).then(m => m || fetch(r)));
});

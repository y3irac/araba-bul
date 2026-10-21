/* Araba Bul service worker: kabuk önbelleğe alınır, fotoğraflar ilk görüldüğünde saklanır. */
const V = "arababul-v3.2";
const SHELL = ["./", "index.html", "styles.css", "config.js", "app.js", "data.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === "navigate" || /\.(js|css|webmanifest)$/.test(url.pathname)) {
    // kod: önce ağ, olmazsa önbellek
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
  } else {
    // görseller: önce önbellek
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); } return res; })));
  }
});

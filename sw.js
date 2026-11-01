/* Almanaque: guarda o app no aparelho para abrir sem internet. O conteúdo protegido não passa por aqui (vem do Supabase e fica no aparelho só depois do login).
   As apostilas cifradas (apostilas/*.bin) são guardadas pela própria página no cache "alm-apostilas", que não é apagado a cada versão. */
const CACHE = "alm-v35";
const KEEP = ["alm-apostilas"];
const SHELL = ["./", "index.html", "aliado.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon.png", "vendor/supabase.js", "vendor/jspdf.umd.min.js", "vendor/jspdf.plugin.autotable.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  // A página: tenta a versão nova primeiro, cai no cache sem internet.
  if (req.mode === "navigate") { e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put("index.html", cp)); return r; }).catch(() => caches.match("index.html"))); return; }
  // Apostilas: a página cuida do cache delas.
  if (url.origin === location.origin && url.pathname.includes("/apostilas/")) return;
  // Leitor de PDF: arquivos que não mudam, então usa o cache sem buscar de novo.
  if (url.origin === location.origin && url.pathname.includes("/vendor/pdfjs/")) { e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; })))); return; }
  // Arquivos do app e fontes: usa o cache e atualiza por trás.
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});

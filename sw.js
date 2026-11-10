// Guarda o "casco" do app (página, estilos, bibliotecas, fontes) para abrir rápido e com pouco dado.
// Os lotes vêm sempre da rede primeiro (mudam com as edições) e caem no cache só sem sinal.
// Os tiles da ortofoto não são guardados aqui: são lidos por faixa de bytes direto do PMTiles.
const VERSAO = 'jacinta-v2';
const CASCO = [
  './', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icon.svg',
  'lib/maplibre-gl.js', 'lib/maplibre-gl.css', 'lib/pmtiles.js',
  'fonts/Noto%20Sans%20Medium/0-255.pbf'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCO)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;          // PMTiles: deixa passar
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;                          // satélite/Supabase: rede
  if (u.pathname.endsWith('.geojson')) {                             // dados: rede primeiro
    e.respondWith(fetch(r).then((resp) => {
      const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put(r, copia)); return resp;
    }).catch(() => caches.match(r)));
    return;
  }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r)));
});

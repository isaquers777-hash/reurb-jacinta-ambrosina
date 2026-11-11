// Service worker do mapa.
//  - Bibliotecas e fontes (não mudam): ficam guardadas no aparelho → abre rápido e com pouco dado.
//  - Página, código, configuração e lotes: rede primeiro (pegam a versão publicada mais nova);
//    o que está guardado só entra quando não há sinal.
//  - Ortofoto: não passa por aqui (leitura por faixa de bytes direto do PMTiles).
const VERSAO = 'jacinta-v5';
const FIXOS = ['lib/maplibre-gl.js', 'lib/maplibre-gl.css', 'lib/pmtiles.js', 'fonts/Noto%20Sans%20Medium/0-255.pbf'];
const PAGINA = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icon.svg', 'data/nucleo.geojson'];

self.addEventListener('install', (e) => {
  // cache:'reload' ignora o cache HTTP do navegador e baixa do servidor.
  e.waitUntil(caches.open(VERSAO)
    .then((c) => c.addAll([...FIXOS, ...PAGINA].map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;   // PMTiles e chamadas POST: direto à rede
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;                   // Supabase, satélite: direto à rede

  if (u.pathname.includes('/lib/') || u.pathname.includes('/fonts/')) {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r)));
    return;
  }
  e.respondWith(
    fetch(r, { cache: 'no-cache' })
      .then((resp) => {
        if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put(r, copia)); }
        return resp;
      })
      .catch(() => caches.match(r).then((hit) => hit || caches.match('index.html')))
  );
});

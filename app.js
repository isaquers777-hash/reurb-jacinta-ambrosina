(() => {
'use strict';
const C = window.APP_CONFIG;
const $ = (id) => document.getElementById(id);
const economia = !!(navigator.connection && navigator.connection.saveData);

$('t-nome').textContent = C.titulo;
$('t-sub').textContent = C.subtitulo;

// ---------- Mapa ----------
const protocolo = new pmtiles.Protocol();
// Tiles totalmente transparentes não são gravados no PMTiles; a biblioteca devolve data:null e o
// MapLibre 4 fica esperando por eles. Entrega um PNG transparente no lugar.
let pngVazio = null;
async function tileVazio() {
  if (pngVazio) return pngVazio;
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const b = await new Promise((r) => c.toBlob(r, 'image/png'));
  return (pngVazio = await b.arrayBuffer());
}
maplibregl.addProtocol('pmtiles', async (params, abort) => {
  const r = await protocolo.tile(params, abort);
  if (r && r.data == null) return { data: await tileVazio() };
  return r;
});
const base = new URL('.', location.href).href;
const urlOrto = new URL(C.ortofoto, base).href;

const map = new maplibregl.Map({
  container: 'map',
  bounds: C.limites,
  fitBoundsOptions: { padding: 40 },
  maxZoom: 22.5,
  minZoom: 11,
  attributionControl: { compact: true },
  dragRotate: true,
  pitchWithRotate: false,
  touchPitch: false,
  fadeDuration: 0,
  maxTileCacheSize: 120,
  style: {
    version: 8,
    glyphs: base + 'fonts/{fontstack}/{range}.pbf',
    sources: {
      sat: {
        type: 'raster', tileSize: 256, maxzoom: 19,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Satélite © Esri'
      },
      orto: { type: 'raster', url: 'pmtiles://' + urlOrto, tileSize: 512, attribution: 'Ortofoto © HOCA Consultoria' },
      // generateId: ids numéricos internos para o destaque do lote (o ID_VINCULO pode ter letra, ex.: 2A)
      nucleo: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, generateId: true }
    },
    layers: [
      { id: 'fundo', type: 'background', paint: { 'background-color': '#e9ecee' } },
      { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
      { id: 'orto', type: 'raster', source: 'orto', paint: { 'raster-fade-duration': 0 } },
      { id: 'lote-fundo', type: 'fill', source: 'nucleo', filter: ['==', ['get', 't'], 'L'],
        paint: { 'fill-color': '#ffd400',
                 'fill-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 0.38, 0.001] } },
      { id: 'nucleo', type: 'line', source: 'nucleo', filter: ['==', ['get', 't'], 'N'],
        paint: { 'line-color': '#ff1e1e', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.6, 19, 3] } },
      { id: 'quadra', type: 'line', source: 'nucleo', filter: ['==', ['get', 't'], 'Q'],
        paint: { 'line-color': '#111', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.6, 19, 1.6] } },
      { id: 'lote', type: 'line', source: 'nucleo', filter: ['==', ['get', 't'], 'L'], minzoom: 15,
        paint: { 'line-color': '#2563ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 0.6, 20, 1.6] } },
      { id: 'lote-sel', type: 'line', source: 'nucleo', filter: ['==', ['get', 't'], 'L'],
        paint: { 'line-color': '#ffd400', 'line-width': 3,
                 'line-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 1, 0] } },
      { id: 'lote-num', type: 'symbol', source: 'nucleo', filter: ['==', ['get', 't'], 'L'], minzoom: 18,
        layout: { 'text-field': ['to-string', ['get', 'l']], 'text-font': ['Noto Sans Medium'],
                  'text-size': ['interpolate', ['linear'], ['zoom'], 18, 10, 21, 15], 'text-padding': 1 },
        paint: { 'text-color': '#0b1b5c', 'text-halo-color': 'rgba(255,255,255,.9)', 'text-halo-width': 1.4 } },
      { id: 'quadra-circ', type: 'circle', source: 'nucleo', filter: ['==', ['get', 't'], 'R'], minzoom: 15,
        paint: { 'circle-color': '#ffe500', 'circle-stroke-color': '#3d3300', 'circle-stroke-width': 1,
                 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 8, 19, 15] } },
      { id: 'quadra-num', type: 'symbol', source: 'nucleo', filter: ['==', ['get', 't'], 'R'], minzoom: 15,
        layout: { 'text-field': ['get', 'q'], 'text-font': ['Noto Sans Medium'], 'text-allow-overlap': true,
                  'text-size': ['interpolate', ['linear'], ['zoom'], 15, 10, 19, 16] },
        paint: { 'text-color': '#111' } }
    ]
  }
});
map.touchZoomRotate.disableRotation();
window.mapa = map; // acesso pelo console para depuração

// ---------- Dados ----------
async function carregarDados() {
  const d = C.dados;
  let resp;
  if (d.tipo === 'supabase') {
    const h = { apikey: d.chaveAnon, 'Content-Type': 'application/json' };
    if (d.chaveAnon.startsWith('eyJ')) h.Authorization = `Bearer ${d.chaveAnon}`; // chave "anon" antiga (JWT)
    resp = await fetch(`${d.url}/rest/v1/rpc/${d.funcao}`, {
      method: 'POST', headers: h, body: JSON.stringify({ p_nucleo: d.nucleo })
    });
  } else {
    resp = await fetch(new URL(d.url, base).href, { cache: 'no-cache' });
  }
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.json();
}

async function carregarReserva() {
  const r = await fetch(new URL(C.dados.reserva, base).href);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// Executa assim que o estilo existir, sem esperar todos os tiles (o evento 'load' espera).
function quandoEstiloPronto(cb) {
  if (map.getSource('nucleo')) cb(); else map.once('styledata', () => quandoEstiloPronto(cb));
}

// Os lotes começam a ser buscados junto com a abertura da página, em paralelo com o mapa.
const comTempo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('tempo')), ms))]);
comTempo(carregarDados(), 12000)
  .catch((e) => {
    if (!C.dados.reserva) throw e;
    aviso('Banco indisponível: mostrando a última cópia dos lotes.', 5000);
    return carregarReserva();
  })
  .then((fc) => quandoEstiloPronto(() => map.getSource('nucleo').setData(fc)))
  .catch(() => aviso('Não foi possível carregar os lotes. Verifique a conexão.'));

quandoEstiloPronto(() => ligarCamada('sat', $('c-sat').checked));

// ---------- Camadas ----------
$('c-sat').checked = C.satelite && !economia;
function ligarCamada(id, on) { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); }
$('c-orto').onchange = (e) => ligarCamada('orto', e.target.checked);
$('c-sat').onchange = (e) => ligarCamada('sat', e.target.checked);
$('c-num').onchange = (e) => ligarCamada('lote-num', e.target.checked);
$('b-camadas').onclick = (e) => { e.stopPropagation(); $('p-camadas').hidden = !$('p-camadas').hidden; };
document.addEventListener('click', (e) => { if (!$('p-camadas').contains(e.target)) $('p-camadas').hidden = true; });
$('b-nucleo').onclick = () => { pararSeguir(); map.fitBounds(C.limites, { padding: 40, duration: 700 }); };

// ---------- Ficha do lote ----------
let selecionado = null;
const fmt = (n, c = 2) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
function selecionar(id) {
  if (selecionado !== null) map.setFeatureState({ source: 'nucleo', id: selecionado }, { sel: false });
  selecionado = id;
  if (id !== null) map.setFeatureState({ source: 'nucleo', id }, { sel: true });
}
function abrirFicha(p) {
  $('f-titulo').textContent = `Quadra ${p.q} · Lote ${p.l}`;
  $('f-dados').innerHTML =
    `<dt>Área</dt><dd>${fmt(p.a)} m²</dd><dt>Perímetro</dt><dd>${fmt(p.p)} m</dd><dt>ID vínculo</dt><dd>${p.id}</dd>`;
  $('ficha').hidden = false;
  document.body.classList.add('com-ficha');
  document.body.style.setProperty('--h-ficha', ($('ficha').offsetHeight - 10) + 'px');
}
function fecharFicha() { $('ficha').hidden = true; document.body.classList.remove('com-ficha'); selecionar(null); }
$('f-fechar').onclick = fecharFicha;
map.on('click', (e) => {
  const f = map.queryRenderedFeatures(e.point, { layers: ['lote-fundo'] })[0];
  if (!f) { fecharFicha(); return; }
  selecionar(f.id);
  abrirFicha(f.properties);
});
map.on('mouseenter', 'lote-fundo', () => (map.getCanvas().style.cursor = 'pointer'));
map.on('mouseleave', 'lote-fundo', () => (map.getCanvas().style.cursor = ''));

// ---------- Avisos ----------
let tAviso;
function aviso(msg, ms = 4000) {
  const el = $('aviso'); el.textContent = msg; el.hidden = false;
  clearTimeout(tAviso); tAviso = setTimeout(() => (el.hidden = true), ms);
}

// ---------- GPS ----------
// Estados: off → buscando → on (mostra) → seguir (centraliza e acompanha o rumo).
const bGps = $('b-gps');
const elEu = document.createElement('div');
elEu.className = 'eu';
elEu.innerHTML = '<div class="raio"></div><div class="cone"></div><div class="ponto"></div>';
const marcador = new maplibregl.Marker({ element: elEu, rotationAlignment: 'map' });
const elRaio = elEu.querySelector('.raio');
const elCone = elEu.querySelector('.cone');

let estado = 'off', watchId = null, wakeLock = null;
let pos = null;          // posição exibida (interpolada)
let alvo = null;         // última leitura
let de = null, t0 = 0, dur = 0, raf = 0;
let precisao = 0, rumo = null, rumoExibido = null, tUltima = 0, primeira = true;

function setEstado(s) { estado = s; bGps.dataset.estado = s; }

bGps.onclick = () => {
  if (estado === 'off') return iniciarGps();
  if (estado === 'on' || estado === 'buscando') { setEstado('seguir'); if (pos) centralizar(true); return; }
  pararGps();
};

function iniciarGps() {
  if (!('geolocation' in navigator)) return aviso('Este aparelho não oferece localização.');
  if (!window.isSecureContext) return aviso('A localização exige HTTPS.');
  setEstado('buscando');
  primeira = true;
  watchId = navigator.geolocation.watchPosition(novaPosicao, erroGps,
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  ligarBussola();
  manterTelaLigada();
}

function pararGps() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null; cancelAnimationFrame(raf); raf = 0;
  marcador.remove(); pos = alvo = null; rumo = rumoExibido = null;
  desligarBussola(); soltarTela();
  $('precisao').hidden = true;
  setEstado('off');
}

function pararSeguir() { if (estado === 'seguir') setEstado('on'); }
map.on('dragstart', (e) => { if (e.originalEvent) pararSeguir(); });

function erroGps(err) {
  if (err.code === 1) { aviso('Permita o acesso à localização nas configurações do navegador.'); pararGps(); }
  else if (estado === 'buscando') aviso('Procurando sinal de GPS…', 2500);
}

function novaPosicao(p) {
  const c = p.coords;
  const novo = [c.longitude, c.latitude];
  precisao = c.accuracy || 0;
  tUltima = performance.now();
  if (c.heading !== null && !isNaN(c.heading) && (c.speed || 0) > 0.8) rumo = c.heading;

  $('precisao').textContent = `± ${precisao < 10 ? precisao.toFixed(1) : Math.round(precisao)} m`;
  $('precisao').hidden = false;
  elEu.classList.remove('velho');

  if (!pos) {
    pos = novo; alvo = novo;
    marcador.setLngLat(pos).addTo(map);
    if (primeira) {
      primeira = false; setEstado('seguir');
      map.flyTo({ center: pos, zoom: Math.max(map.getZoom(), 18.5), duration: 1200, essential: true });
    }
  } else {
    // Interpola da posição exibida até a nova leitura, no intervalo típico entre leituras.
    de = pos; alvo = novo; t0 = performance.now(); dur = 900;
  }
  if (estado === 'buscando') setEstado('on');
  if (!raf) raf = requestAnimationFrame(quadro);
}

const lerpAng = (a, b, t) => { const d = ((b - a + 540) % 360) - 180; return (a + d * t + 360) % 360; };

function quadro(agora) {
  raf = 0;
  if (!pos) return;
  let animando = false;
  if (de && alvo) {
    const t = Math.min(1, (agora - t0) / dur);
    const e = t * (2 - t); // suavização
    pos = [de[0] + (alvo[0] - de[0]) * e, de[1] + (alvo[1] - de[1]) * e];
    if (t >= 1) de = null; else animando = true;
    marcador.setLngLat(pos);
  }
  if (rumo !== null) {
    rumoExibido = rumoExibido === null ? rumo : lerpAng(rumoExibido, rumo, 0.18);
    if (Math.abs(((rumo - rumoExibido + 540) % 360) - 180) > 0.5) animando = true;
  }
  atualizarMarcador();
  if (estado === 'seguir') centralizar(false);
  if (agora - tUltima > 15000) elEu.classList.add('velho');
  if (animando) raf = requestAnimationFrame(quadro);
}

function atualizarMarcador() {
  if (!pos) return;
  const mpp = 40075016.686 * Math.cos(pos[1] * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
  const d = Math.max(18, Math.min(2 * precisao / mpp, 4000));
  elRaio.style.width = elRaio.style.height = d + 'px';
  if (rumoExibido !== null) {
    elEu.classList.add('com-rumo');
    elCone.style.transform = `rotate(${rumoExibido}deg)`;
  }
}
map.on('zoom', atualizarMarcador);

function centralizar(animado) {
  if (!pos) return;
  if (animado) { map.easeTo({ center: pos, duration: 500 }); return; }
  // Não briga com animações de câmera nem com o gesto de zoom do usuário.
  if (!map.isMoving()) map.setCenter(pos);
}

// Bússola: dá o rumo parado (o GPS só informa rumo em movimento).
let ouvinteBussola = null;
function ligarBussola() {
  const ouvir = () => {
    ouvinteBussola = (ev) => {
      let h = null;
      if (typeof ev.webkitCompassHeading === 'number') h = ev.webkitCompassHeading;
      else if (ev.absolute && typeof ev.alpha === 'number') h = (360 - ev.alpha) % 360;
      if (h === null) return;
      const orient = (screen.orientation && screen.orientation.angle) || 0;
      rumo = (h + orient) % 360;
      if (!raf && pos) raf = requestAnimationFrame(quadro);
    };
    window.addEventListener('deviceorientationabsolute', ouvinteBussola);
    window.addEventListener('deviceorientation', ouvinteBussola);
  };
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    D.requestPermission().then((r) => { if (r === 'granted') ouvir(); }).catch(() => {});
  } else if (D) ouvir();
}
function desligarBussola() {
  if (!ouvinteBussola) return;
  window.removeEventListener('deviceorientationabsolute', ouvinteBussola);
  window.removeEventListener('deviceorientation', ouvinteBussola);
  ouvinteBussola = null;
}

// Mantém a tela acesa enquanto o GPS está ligado (útil em campo).
async function manterTelaLigada() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
}
function soltarTela() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && watchId !== null && !wakeLock) manterTelaLigada();
});

// ---------- Offline do "casco" do app ----------
if ('serviceWorker' in navigator && window.isSecureContext) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();

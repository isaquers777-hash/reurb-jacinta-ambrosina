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
const COR_CAD = '#16a34a';   // CADASTRADO
const COR_EMC = '#f97316';   // EM CADASTRAMENTO
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
      // promoteId 'k' (fid numérico do banco): o ID_VINCULO pode ter letra (ex.: 2A) e não serve de id interno
      nucleo: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'k' }
    },
    layers: [
      { id: 'fundo', type: 'background', paint: { 'background-color': '#e9ecee' } },
      { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
      { id: 'orto', type: 'raster', source: 'orto', paint: { 'raster-fade-duration': 0 } },
      { id: 'lote-fundo', type: 'fill', source: 'nucleo', filter: ['==', ['get', 't'], 'L'],
        paint: { 'fill-color': '#ffd400',
                 'fill-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 0.38, 0.001] } },
      // Situação do cadastro: verde = CADASTRADO, laranja = EM CADASTRAMENTO
      { id: 'lote-sit-fundo', type: 'fill', source: 'nucleo',
        filter: ['all', ['==', ['get', 't'], 'L'], ['has', 's']],
        paint: { 'fill-color': ['match', ['get', 's'], 'CADASTRADO', COR_CAD, COR_EMC], 'fill-opacity': 0.34 } },
      { id: 'nucleo', type: 'line', source: 'nucleo', filter: ['==', ['get', 't'], 'N'],
        paint: { 'line-color': '#ff1e1e', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.6, 19, 3] } },
      { id: 'quadra', type: 'line', source: 'nucleo', filter: ['==', ['get', 't'], 'Q'],
        paint: { 'line-color': '#111', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.6, 19, 1.6] } },
      { id: 'lote', type: 'line', source: 'nucleo', filter: ['==', ['get', 't'], 'L'], minzoom: 15,
        paint: { 'line-color': '#2563ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 0.6, 20, 1.6] } },
      { id: 'lote-sit', type: 'line', source: 'nucleo', filter: ['all', ['==', ['get', 't'], 'L'], ['has', 's']],
        paint: { 'line-color': ['match', ['get', 's'], 'CADASTRADO', COR_CAD, COR_EMC],
                 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.5, 19, 3] } },
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
const SB = C.dados.tipo === 'supabase';
const CHAVE_FILA = 'reurb_fila:' + (C.dados.nucleo || C.titulo);
const CHAVE_PIN = 'reurb_pin';
const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch (_) { return padrao; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

let dados = null;                      // FeatureCollection exibida
let fila = ler(CHAVE_FILA, []);        // marcações feitas no aparelho e ainda não confirmadas pelo banco
let ultimaCarga = 0;

async function rpc(funcao, corpo) {
  const d = C.dados;
  const h = { apikey: d.chaveAnon, 'Content-Type': 'application/json' };
  if (d.chaveAnon.startsWith('eyJ')) h.Authorization = `Bearer ${d.chaveAnon}`; // chave "anon" antiga (JWT)
  const r = await fetch(`${d.url}/rest/v1/rpc/${funcao}`, { method: 'POST', headers: h, body: JSON.stringify(corpo) });
  if (!r.ok) {
    const e = new Error('HTTP ' + r.status); e.status = r.status;
    try { e.msg = (await r.json()).message; } catch (_) {}
    throw e;
  }
  return r.json();
}

async function carregarDados() {
  if (SB) return rpc(C.dados.funcao, { p_nucleo: C.dados.nucleo });
  const r = await fetch(new URL(C.dados.url, base).href, { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
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

// Marcações ainda pendentes valem por cima do que veio do banco.
function aplicarFila(fc) {
  const porId = new Map(fila.map((m) => [m.id, m]));
  for (const f of fc.features) {
    const p = f.properties;
    if (p.t !== 'L') continue;
    delete p.pend;
    if (!porId.has(p.id)) continue;
    const m = porId.get(p.id);
    if (m.s) p.s = m.s; else delete p.s;
    p.em = m.em; p.pend = true;
  }
  return fc;
}
function limparNulos(fc) {
  for (const f of fc.features) { const p = f.properties; if (p.s == null) delete p.s; if (p.em == null) delete p.em; }
  return fc;
}

function redesenhar() {
  quandoEstiloPronto(() => {
    map.getSource('nucleo').setData(dados);
    if (selecionado !== null) {
      const f = loteK(selecionado);
      if (f) { map.setFeatureState({ source: 'nucleo', id: selecionado }, { sel: true }); abrirFicha(f.properties); }
      else fecharFicha();
    }
  });
  atualizarContagem();
}

const CHAVE_CACHE = 'reurb_ultima_carga:' + (C.dados.nucleo || C.titulo);
let doBanco = false;           // true quando o que está na tela veio do banco nesta sessão

function mostrar(fc, origem) {
  dados = aplicarFila(limparNulos(fc));
  doBanco = origem === 'banco';
  if (doBanco) { ultimaCarga = Date.now(); gravar(CHAVE_CACHE, fc); }  // última versão do banco fica no aparelho
  redesenhar();
}

const loteK = (k) => dados && dados.features.find((f) => f.properties.t === 'L' && f.properties.k === k);

const comTempo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('tempo')), ms))]);
function atualizar(primeira) {
  return comTempo(carregarDados(), 12000)
    .then((fc) => mostrar(fc, SB ? 'banco' : 'arquivo'))
    .catch((e) => {
      if (!primeira) return;                       // recargas silenciosas: mantém o que está na tela
      const guardado = ler(CHAVE_CACHE, null);     // 1º: última versão do banco guardada no aparelho
      if (guardado) { aviso('Sem conexão com o banco: mostrando os dados da última visita.', 5000); return mostrar(guardado, 'cache'); }
      if (!C.dados.reserva) throw e;               // 2º: cópia estática publicada com o site
      aviso('Banco indisponível: mostrando a cópia publicada dos lotes.', 5000);
      return carregarReserva().then((fc) => mostrar(fc, 'reserva'));
    })
    .catch(() => aviso('Não foi possível carregar os lotes. Verifique a conexão.'));
}

// Os lotes começam a ser buscados junto com a abertura da página, em paralelo com o mapa.
atualizar(true).then(enviarFila);

// Traz marcações feitas por outros aparelhos: ao voltar para a página e a cada 2 minutos.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - ultimaCarga > 30000) atualizar(false).then(enviarFila);
});
setInterval(() => { if (document.visibilityState === 'visible') atualizar(false).then(enviarFila); }, 120000);
// Sinal voltou: envia o que ficou guardado e traz a versão atual do banco.
addEventListener('online', () => enviarFila().then(() => atualizar(false)));

quandoEstiloPronto(() => ligarCamada('sat', $('c-sat').checked));

// ---------- Camadas ----------
$('c-sat').checked = C.satelite && !economia;
function ligarCamada(id, on) { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); }
$('c-orto').onchange = (e) => ligarCamada('orto', e.target.checked);
$('c-sat').onchange = (e) => ligarCamada('sat', e.target.checked);
$('c-num').onchange = (e) => ligarCamada('lote-num', e.target.checked);
$('c-sit').onchange = (e) => { ligarCamada('lote-sit', e.target.checked); ligarCamada('lote-sit-fundo', e.target.checked); };
$('b-camadas').onclick = (e) => { e.stopPropagation(); $('p-camadas').hidden = !$('p-camadas').hidden; };
document.addEventListener('click', (e) => { if (!$('p-camadas').contains(e.target)) $('p-camadas').hidden = true; });
$('b-nucleo').onclick = () => { pararSeguir(); map.fitBounds(C.limites, { padding: 40, duration: 700 }); };

function atualizarContagem() {
  if (!dados) return;
  let cad = 0, emc = 0;
  for (const f of dados.features) {
    if (f.properties.t !== 'L') continue;
    if (f.properties.s === 'CADASTRADO') cad++; else if (f.properties.s === 'EM CADASTRAMENTO') emc++;
  }
  const pend = fila.length;
  const partes = [];
  if (cad) partes.push(`<i style="background:${COR_CAD}"></i>${cad} cadastrado${cad === 1 ? '' : 's'}`);
  if (emc) partes.push(`<i style="background:${COR_EMC}"></i>${emc} em cadastramento`);
  if (pend) partes.push(`<b>${pend} a enviar</b>`);
  $('t-cont').innerHTML = partes.join(' ');
  $('t-cont').hidden = !(cad || emc || pend);
}

// ---------- Ficha do lote ----------
let selecionado = null;        // k (fid) do lote selecionado
const fmt = (n, c = 2) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
const fmtData = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
function selecionar(k) {
  if (selecionado !== null) map.setFeatureState({ source: 'nucleo', id: selecionado }, { sel: false });
  selecionado = k;
  if (k !== null) map.setFeatureState({ source: 'nucleo', id: k }, { sel: true });
}
const NOME_SIT = { 'CADASTRADO': 'Cadastrado', 'EM CADASTRAMENTO': 'Em cadastramento' };
function abrirFicha(p) {
  $('f-titulo').textContent = `Quadra ${p.q} · Lote ${p.l}`;
  const sit = p.s ? `<span class="sit ${p.s === 'CADASTRADO' ? 'cad' : 'emc'}">${NOME_SIT[p.s]}</span>`
                  : '<span class="sit nada">Sem marcação</span>';
  const quando = p.em ? `<small>${p.pend ? 'aguardando envio · ' : ''}${fmtData(p.em)}</small>` : '';
  $('f-sit').innerHTML = sit + quando;
  $('f-acoes').hidden = !SB;
  for (const b of $('f-acoes').querySelectorAll('button')) {
    b.classList.toggle('ativo', (b.dataset.s || null) === (p.s || null) && !!b.dataset.s);
    if (!b.dataset.s) b.hidden = !p.s;
  }
  $('f-dados').innerHTML =
    `<dt>Área</dt><dd>${fmt(p.a)} m²</dd><dt>Perímetro</dt><dd>${fmt(p.p)} m</dd><dt>ID vínculo</dt><dd>${p.id}</dd>`;
  $('ficha').hidden = false;
  document.body.classList.add('com-ficha');
  document.body.style.setProperty('--h-ficha', ($('ficha').offsetHeight - 10) + 'px');
}
function fecharFicha() {
  $('ficha').hidden = true; $('f-pin').hidden = true; document.body.classList.remove('com-ficha'); selecionar(null);
}
$('f-fechar').onclick = fecharFicha;
map.on('click', (e) => {
  const f = map.queryRenderedFeatures(e.point, { layers: ['lote-fundo'] })[0];
  if (!f) { fecharFicha(); return; }
  $('f-pin').hidden = true;
  selecionar(f.id);
  abrirFicha(loteK(f.id).properties);
});
map.on('mouseenter', 'lote-fundo', () => (map.getCanvas().style.cursor = 'pointer'));
map.on('mouseleave', 'lote-fundo', () => (map.getCanvas().style.cursor = ''));

// ---------- Marcação de cadastro ----------
$('f-acoes').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || selecionado === null) return;
  marcar(selecionado, b.dataset.s || null);
});

function marcar(k, s) {
  const f = loteK(k); if (!f) return;
  if (!ler(CHAVE_PIN, null)) return pedirPin(() => marcar(k, s));
  const p = f.properties;
  if ((p.s || null) === s) return;
  const em = new Date().toISOString();
  fila = fila.filter((m) => m.id !== p.id).concat([{ id: p.id, s, em }]);
  gravar(CHAVE_FILA, fila);
  aplicarFila(dados);
  redesenhar();
  enviarFila();
}

let enviando = false;
async function enviarFila() {
  if (!SB || enviando || !fila.length) return;
  const pin = ler(CHAVE_PIN, null);
  if (!pin) return;
  enviando = true;
  try {
    while (fila.length) {
      const m = fila[0];
      const r = await comTempo(rpc('reurb_marcar', { p_nucleo: C.dados.nucleo, p_id: m.id, p_status: m.s || '', p_pin: pin }), 15000);
      if (r && r.erro === 'pin') {
        gravar(CHAVE_PIN, null);
        aviso('PIN da equipe não confere. Toque no lote e marque de novo para digitar o PIN.', 6000);
        break;
      }
      fila.shift(); gravar(CHAVE_FILA, fila);
      const f = dados && dados.features.find((x) => x.properties.t === 'L' && x.properties.id === m.id);
      if (r && r.erro === 'lote') aviso(`O lote de ID ${m.id} não existe mais no banco; marcação descartada.`, 6000);
      else if (f && !fila.some((x) => x.id === m.id)) {
        const p = f.properties; delete p.pend;
        if (r.s) p.s = r.s; else delete p.s;
        p.em = r.em;
      }
    }
  } catch (e) {
    if (e.status) aviso(e.msg || 'O banco recusou a marcação. Tente de novo em instantes.', 6000);
    // sem sinal: as marcações continuam guardadas no aparelho e seguem quando a conexão voltar
  } finally {
    enviando = false;
    if (dados) { aplicarFila(dados); redesenhar(); }
  }
  // Se a tela estava com dados guardados (sem sinal), traz a versão atual do banco depois de enviar.
  if (!doBanco && !fila.length) await atualizar(false);
}
setInterval(() => { if (fila.length && navigator.onLine) enviarFila(); }, 30000);

// PIN da equipe: pedido uma vez por aparelho, conferido no banco.
let depoisDoPin = null;
function pedirPin(cb) {
  depoisDoPin = cb;
  $('f-pin').hidden = false; $('f-pin-msg').textContent = '';
  $('f-pin-in').value = ''; $('f-pin-in').focus();
  document.body.style.setProperty('--h-ficha', ($('ficha').offsetHeight - 10) + 'px');
}
$('f-pin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = $('f-pin-in').value.trim();
  if (pin.length < 6) { $('f-pin-msg').textContent = 'O PIN tem pelo menos 6 caracteres.'; return; }
  $('f-pin-msg').textContent = 'Conferindo…';
  try {
    const ok = await comTempo(rpc('reurb_pin_ok', { p_pin: pin }), 12000);
    if (!ok) { $('f-pin-msg').textContent = 'PIN incorreto.'; return; }
  } catch (err) {
    if (err.status) { $('f-pin-msg').textContent = err.msg || 'Não foi possível conferir o PIN.'; return; }
    // sem sinal: guarda e confere no envio
  }
  gravar(CHAVE_PIN, pin);
  $('f-pin').hidden = true;
  const cb = depoisDoPin; depoisDoPin = null; if (cb) cb();
});

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

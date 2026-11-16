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
      nucleo: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'k' },
      // lados (LineString com a medida) e vértices numerados do lote selecionado
      medidas: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      ruas: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
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
      // Nomes das ruas ao longo do eixo da via (o traçado já aparece na ortofoto)
      { id: 'rua-nome', type: 'symbol', source: 'ruas', minzoom: 15.5, filter: ['!=', ['get', 'n'], ''],
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Medium'],
                  'text-size': ['interpolate', ['linear'], ['zoom'], 15.5, 10, 18, 12.5, 21, 15],
                  'symbol-spacing': 320, 'text-max-angle': 35, 'text-keep-upright': true, 'text-padding': 4,
                  'text-letter-spacing': 0.03 },
        paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(20,24,30,.85)', 'text-halo-width': 1.6 } },
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
        paint: { 'text-color': '#111' } },
      // Medidas do lote selecionado: texto ao longo de cada lado e vértices numerados
      { id: 'med-lado', type: 'symbol', source: 'medidas', filter: ['==', ['get', 'm'], 'lado'],
        layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'txt'], 'text-font': ['Noto Sans Medium'],
                  'text-size': ['interpolate', ['linear'], ['zoom'], 17, 10, 20, 13, 22, 16],
                  'text-offset': [0, -0.75], 'text-keep-upright': true, 'text-padding': 0,
                  'text-max-angle': 90, 'text-allow-overlap': false },
        paint: { 'text-color': '#111', 'text-halo-color': '#fff', 'text-halo-width': 1.6 } },
      { id: 'med-vert', type: 'circle', source: 'medidas', filter: ['==', ['get', 'm'], 'vert'],
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 17, 2.5, 20, 4], 'circle-color': '#ffd400',
                 'circle-stroke-color': '#111', 'circle-stroke-width': 1.2 } },
      { id: 'med-vert-num', type: 'symbol', source: 'medidas', filter: ['==', ['get', 'm'], 'vert'], minzoom: 18.5,
        layout: { 'text-field': ['get', 'txt'], 'text-font': ['Noto Sans Medium'], 'text-size': 11,
                  'text-offset': ['get', 'off'], 'text-allow-overlap': true },
        paint: { 'text-color': '#7a2e00', 'text-halo-color': '#fff', 'text-halo-width': 1.6 } }
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
const CHAVE_FILA_FORM = 'reurb_fila_form:' + (C.dados.nucleo || C.titulo);
let filaForm = ler(CHAVE_FILA_FORM, []);  // formulários salvos sem sinal (apagados do aparelho assim que chegam ao banco)
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

// Marcações e formulários ainda pendentes valem por cima do que veio do banco.
function aplicarFila(fc) {
  const porId = new Map(fila.map((m) => [m.id, m]));
  const forms = new Map(filaForm.map((m) => [m.id, m]));
  for (const f of fc.features) {
    const p = f.properties;
    if (p.t !== 'L') continue;
    delete p.pend;
    if (porId.has(p.id)) {
      const m = porId.get(p.id);
      if (m.s) p.s = m.s; else delete p.s;
      p.em = m.em; p.pend = true;
    }
    if (forms.has(p.id)) {          // formulário salvo sem sinal: o lote já aparece em cadastramento
      if (p.f !== 2) { p.s = 'EM CADASTRAMENTO'; p.f = 1; }
      p.em = forms.get(p.id).em; p.pend = true;
    }
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
$('c-ruas').onchange = (e) => ligarCamada('rua-nome', e.target.checked);

// Ruas: rótulos no mapa e sugestão de endereço no cadastro (rua mais próxima do lote).
let ruas = [];
if (C.ruas) {
  fetch(new URL(C.ruas, base).href).then((r) => r.ok ? r.json() : null).then((fc) => {
    if (!fc) return;
    ruas = fc.features.filter((f) => f.properties.n);
    quandoEstiloPronto(() => map.getSource('ruas').setData(fc));
    const nomes = [...new Set(ruas.map((f) => f.properties.n))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    $('lista-ruas').innerHTML = nomes.map((n) => `<option value="${esc(n)}">`).join('');
  }).catch(() => {});
}
// Rua mais próxima de qualquer vértice do lote (a testada encosta na rua de frente).
function ruaMaisProxima(pts) {
  const e = escalaLocal(pts[0][1]);
  let melhor = null, dMin = Infinity;
  for (const f of ruas) {
    const c = f.geometry.coordinates;
    for (const pt of pts) for (let i = 1; i < c.length; i++) {
      const ax = (c[i - 1][0] - pt[0]) * e.x, ay = (c[i - 1][1] - pt[1]) * e.y;
      const bx = (c[i][0] - pt[0]) * e.x, by = (c[i][1] - pt[1]) * e.y;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < dMin) { dMin = d; melhor = f.properties.n; }
    }
  }
  return dMin < 80 ? melhor : '';
}
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
  const pend = fila.length + filaForm.length;
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
  const fo = p.f || 0;
  const nota = fo === 2 ? 'Confirmado pelo administrador'
             : fo === 1 ? 'Formulário preenchido · aguardando confirmação'
             : p.s === 'CADASTRADO' ? 'Marcado antes do formulário' : '';
  $('f-sit').innerHTML = sit + quando + (nota ? `<small class="nota">${nota}</small>` : '');
  $('f-acoes').hidden = !SB;
  $('b-form').textContent = fo === 0 ? 'Preencher cadastro' : fo === 2 ? 'Ver cadastro' : 'Ver / editar cadastro';
  $('b-fin').hidden = !(fo === 1 && !p.pend);
  $('b-limpar').hidden = !SB || !p.s || !!p.pend;
  $('f-dados').innerHTML =
    `<dt>Área</dt><dd>${fmt(p.a)} m²</dd><dt>Perímetro</dt><dd>${fmt(p.p)} m</dd><dt>ID vínculo</dt><dd>${p.id}</dd>`;
  const f = loteK(p.k);
  mostrarMedidas(f ? medirLote(f.geometry) : null);
  $('ficha').hidden = false;
  document.body.classList.add('com-ficha');
  ajustarFicha();
}
function fecharFicha() {
  $('ficha').hidden = true; document.body.classList.remove('com-ficha'); selecionar(null);
  mostrarMedidas(null);
}
// Os botões do mapa sobem junto com a ficha (a altura muda ao abrir o croqui, o PIN etc.)
function ajustarFicha() { document.body.style.setProperty('--h-ficha', ($('ficha').offsetHeight - 10) + 'px'); }
if ('ResizeObserver' in window) new ResizeObserver(() => { if (!$('ficha').hidden) ajustarFicha(); }).observe($('ficha'));

// ---------- Medidas e croqui do lote ----------
// Distância no elipsoide GRS80 (SIRGAS 2000) por escala local: erro de milímetros em lados de dezenas de metros.
// Conferido com o perímetro geodésico do banco (PostGIS): diferença máxima de 4 cm no lote inteiro.
const GRS_A = 6378137, GRS_E2 = 0.00669438002290;
const RAD = Math.PI / 180;
function escalaLocal(lat) {
  const w = Math.sqrt(1 - GRS_E2 * Math.sin(lat * RAD) ** 2);
  return { x: (GRS_A / w) * Math.cos(lat * RAD) * RAD, y: (GRS_A * (1 - GRS_E2) / w ** 3) * RAD };  // m por grau
}
const distM = (a, b) => { const e = escalaLocal((a[1] + b[1]) / 2); return Math.hypot((b[0] - a[0]) * e.x, (b[1] - a[1]) * e.y); };

// Vértices do contorno a partir do mais ao norte (empate: o mais a oeste), em sentido horário — padrão de memorial.
function medirLote(geom) {
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  const ext = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];   // contorno principal
  if (!ext) return null;
  let v = [];
  for (const c of ext) { const u = v[v.length - 1]; if (!u || u[0] !== c[0] || u[1] !== c[1]) v.push(c); }
  if (v.length > 1 && v[0][0] === v[v.length - 1][0] && v[0][1] === v[v.length - 1][1]) v.pop();
  if (v.length < 3) return null;
  const lat0 = v.reduce((s, c) => s + c[1], 0) / v.length, lon0 = v.reduce((s, c) => s + c[0], 0) / v.length;
  const e = escalaLocal(lat0);
  let xy = v.map((c) => [(c[0] - lon0) * e.x, (c[1] - lat0) * e.y]);
  let area2 = 0;
  for (let i = 0; i < xy.length; i++) { const a = xy[i], b = xy[(i + 1) % xy.length]; area2 += a[0] * b[1] - b[0] * a[1]; }
  if (area2 > 0) { v.reverse(); xy.reverse(); }                 // anti-horário → horário
  let i0 = 0;
  xy.forEach((p, i) => { const q = xy[i0]; if (p[1] > q[1] + 0.01 || (Math.abs(p[1] - q[1]) <= 0.01 && p[0] < q[0])) i0 = i; });
  v = v.slice(i0).concat(v.slice(0, i0)); xy = xy.slice(i0).concat(xy.slice(0, i0));
  const n = v.length;
  const lados = v.map((c, i) => ({ de: i + 1, para: (i + 1) % n + 1, a: c, b: v[(i + 1) % n], m: distM(c, v[(i + 1) % n]) }));
  return { v, xy, lados };
}

const txtM = (m) => fmt(m) + ' m';

function mostrarMedidas(med) {
  // mapa
  const feats = [];
  if (med) {
    const n = med.v.length;
    med.lados.forEach((l) => feats.push({ type: 'Feature', properties: { m: 'lado', txt: txtM(l.m) },
      geometry: { type: 'LineString', coordinates: [l.a, l.b] } }));
    med.v.forEach((c, i) => {
      // número do vértice para fora do lote, na bissetriz dos dois lados
      const p = med.xy[i], a = med.xy[(i - 1 + n) % n], b = med.xy[(i + 1) % n];
      const u1 = unit([p[0] - a[0], p[1] - a[1]]), u2 = unit([b[0] - p[0], b[1] - p[1]]);
      // em sentido horário, a normal externa de (dx,dy) é (-dy,dx)
      let o = unit([-(u1[1] + u2[1]), u1[0] + u2[0]]);
      if (!o[0] && !o[1]) o = [-u1[1], u1[0]];
      feats.push({ type: 'Feature', properties: { m: 'vert', txt: String(i + 1), off: [o[0] * 1.1, -o[1] * 1.1] },
        geometry: { type: 'Point', coordinates: c } });
    });
  }
  quandoEstiloPronto(() => map.getSource('medidas').setData({ type: 'FeatureCollection', features: feats }));
  // croqui
  $('f-croqui').hidden = !med;
  if (med) desenharCroqui(med);
}
function unit(d) { const h = Math.hypot(d[0], d[1]); return h ? [d[0] / h, d[1] / h] : [0, 0]; }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function desenharCroqui(med) {
  const W = 320, H = 230, M = 34;                 // margem para os textos
  const xs = med.xy.map((p) => p[0]), ys = med.xy.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min((W - 2 * M) / Math.max(x1 - x0, 0.01), (H - 2 * M) / Math.max(y1 - y0, 0.01));
  const cx = (W - (x1 - x0) * s) / 2, cy = (H - (y1 - y0) * s) / 2;
  const P = med.xy.map((p) => [cx + (p[0] - x0) * s, H - cy - (p[1] - y0) * s]);   // norte para cima
  const n = P.length;
  let g = `<polygon class="cq-lote" points="${P.map((p) => p.map((c) => c.toFixed(1)).join(',')).join(' ')}"/>`;
  med.lados.forEach((l, i) => {
    const a = P[i], b = P[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const d = unit([b[0] - a[0], b[1] - a[1]]);
    // na tela (y para baixo) e sentido horário no terreno, a normal externa é (d.y, -d.x)
    const nx = d[1], ny = -d[0];
    let ang = Math.atan2(d[1], d[0]) / RAD;
    if (ang > 90) ang -= 180; else if (ang <= -90) ang += 180;
    const tx = mx + nx * 9, ty = my + ny * 9;
    const comp = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (comp < 14) return;                         // lado pequeno demais no desenho: a medida fica só na lista
    const curto = comp < 28;
    g +=`<text class="cq-med${curto ? ' curto' : ''}" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" `
       + `transform="rotate(${ang.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})">${esc(fmt(l.m))}</text>`;
  });
  P.forEach((p, i) => {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    const u1 = unit([p[0] - a[0], p[1] - a[1]]), u2 = unit([b[0] - p[0], b[1] - p[1]]);
    let o = unit([u1[1] + u2[1], -(u1[0] + u2[0])]);
    if (!o[0] && !o[1]) o = [u1[1], -u1[0]];
    g += `<circle class="cq-v" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`
       + `<text class="cq-vn" x="${(p[0] + o[0] * 11).toFixed(1)}" y="${(p[1] + o[1] * 11).toFixed(1)}">${i + 1}</text>`;
  });
  // norte e escala
  g += `<g class="cq-norte" transform="translate(${W - 14} 16)"><path d="M0 -10 L5 4 L0 1 L-5 4 Z"/><text y="15">N</text></g>`;
  const passos = [1, 2, 5, 10, 20, 50, 100];
  const esc_m = passos.find((m) => m * s >= 40) || 100;
  g += `<g class="cq-escala" transform="translate(10 ${H - 10})"><path d="M0 -4 V0 H${(esc_m * s).toFixed(1)} V-4"/>`
     + `<text x="${(esc_m * s / 2).toFixed(1)}" y="-6">${esc_m} m</text></g>`;
  $('f-svg').innerHTML = g;
  const tot = med.lados.reduce((t, l) => t + l.m, 0);
  $('f-lados').innerHTML = med.lados.map((l) => `<li><span>${l.de} – ${l.para}</span><b>${txtM(l.m)}</b></li>`).join('')
    + `<li class="tot"><span>Soma dos lados</span><b>${txtM(tot)}</b></li>`;
}
try { if (localStorage.getItem('reurb_croqui') === '0') $('f-croqui').open = false; } catch (_) {}
$('f-croqui').addEventListener('toggle', () => { try { localStorage.setItem('reurb_croqui', $('f-croqui').open ? '1' : '0'); } catch (_) {} });
$('c-med').onchange = (e) => { for (const id of ['med-lado', 'med-vert', 'med-vert-num']) ligarCamada(id, e.target.checked); };
$('f-fechar').onclick = fecharFicha;
map.on('click', (e) => {
  const f = map.queryRenderedFeatures(e.point, { layers: ['lote-fundo'] })[0];
  if (!f) { fecharFicha(); return; }
  selecionar(f.id);
  const lote = loteK(f.id);
  abrirFicha(lote.properties);
  enquadrarLote(lote);
});

// Se o lote ficou atrás da ficha (ou fora da tela), leva-o para a parte visível do mapa.
function enquadrarLote(f) {
  const cs = (f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.flat(2) : f.geometry.coordinates.flat(1));
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  for (const c of cs) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }
  const fic = $('ficha').getBoundingClientRect(), W = innerWidth, H = innerHeight;
  const lateral = fic.width < W * 0.9;                       // computador: ficha ao lado; celular: embaixo
  const pad = { top: 90, left: 24, right: lateral ? W - fic.left + 16 : 24, bottom: lateral ? 24 : H - fic.top + 16 };
  const a = map.project([x0, y1]), b = map.project([x1, y0]);
  const visivel = a.x >= pad.left && a.y >= pad.top && b.x <= W - pad.right && b.y <= H - pad.bottom;
  const largo = (b.x - a.x) > 60 || (b.y - a.y) > 60;
  if (visivel && largo) return;
  if (W - pad.left - pad.right < 80 || H - pad.top - pad.bottom < 80) return;   // tela pequena demais
  pararSeguir();
  map.fitBounds([[x0, y0], [x1, y1]], { padding: pad, maxZoom: Math.max(map.getZoom(), 19.5), duration: 500 });
}
map.on('mouseenter', 'lote-fundo', () => (map.getCanvas().style.cursor = 'pointer'));
map.on('mouseleave', 'lote-fundo', () => (map.getCanvas().style.cursor = ''));

// ---------- Cadastro do lote ----------
// Regras (garantidas também no banco):
//   · "Preencher cadastro" pede o formulário completo; ao salvar, o lote fica EM CADASTRAMENTO.
//   · Só o código de administrador confirma o cadastro (CADASTRADO), corrige um cadastro confirmado
//     ou remove a marcação.
//   · Os dados do formulário só saem do banco com o PIN; nunca entram na parte pública do mapa.
$('b-form').onclick = () => { if (selecionado !== null) abrirFormulario(selecionado); };
$('b-fin').onclick = () => { if (selecionado !== null) finalizar(selecionado); };
$('b-limpar').onclick = () => { if (selecionado !== null) limparMarcacao(selecionado); };

const loteId = (id) => dados && dados.features.find((x) => x.properties.t === 'L' && x.properties.id === id);
function atualizarLote(id, r) {
  const f = loteId(id); if (!f) return;
  const p = f.properties; delete p.pend;
  if (r.s) p.s = r.s; else delete p.s;
  p.em = r.em; if (r.f != null) p.f = r.f;
}
const offline = (e) => !e.status;    // erro sem resposta do servidor = sem sinal

// --- Pedido do PIN da equipe / código de administrador ---
let dlgCb = null, dlgModo = 'equipe';
function pedirCodigo(modo, cb) {
  dlgModo = modo; dlgCb = cb;
  $('dlg-titulo').textContent = modo === 'admin' ? 'Código de administrador' : 'PIN da equipe';
  $('dlg-msg').textContent = '';
  $('dlg-in').value = ''; $('dlg').hidden = false; $('dlg-in').focus();
}
$('dlg-cancelar').onclick = () => { $('dlg').hidden = true; dlgCb = null; };
$('dlg-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cod = $('dlg-in').value.trim();
  const min = dlgModo === 'admin' ? 8 : 6;
  if (cod.length < min) {
    $('dlg-msg').textContent = dlgModo === 'admin' ? 'Digite o código de administrador (8 dígitos). O PIN da equipe não confirma cadastros.'
                                                  : 'O PIN tem pelo menos 6 caracteres.';
    return;
  }
  $('dlg-msg').textContent = 'Conferindo…';
  let papel = null;
  try { papel = await comTempo(rpc('reurb_papel', { p_codigo: cod }), 12000); }
  catch (err) {
    if (!offline(err)) { $('dlg-msg').textContent = err.msg || 'Não foi possível conferir.'; return; }
    if (dlgModo === 'admin') { $('dlg-msg').textContent = 'Sem conexão: a confirmação do administrador precisa de internet.'; return; }
    papel = 'equipe';            // sem sinal: guarda o PIN e o banco confere no envio
  }
  if (!papel) { $('dlg-msg').textContent = dlgModo === 'admin' ? 'Código incorreto.' : 'PIN incorreto.'; return; }
  if (dlgModo === 'admin' && papel !== 'admin') { $('dlg-msg').textContent = 'Este é o PIN da equipe, não o código de administrador.'; return; }
  if (dlgModo === 'equipe') gravar(CHAVE_PIN, cod);
  $('dlg').hidden = true;
  const cb = dlgCb; dlgCb = null; if (cb) cb(cod);
});

// --- Formulário ---
const CAMPOS = ['nome', 'escolaridade', 'profissao', 'renda_tipo', 'renda_valor', 'telefone', 'rua', 'numero', 'bairro', 'cadunico', 'bolsa_familia'];
const fm = $('cad-form');
let cadLote = null;       // { k, id, finalizado }
let cadCodigoAdmin = null; // só vale enquanto o formulário está aberto

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
function mascaraTel(s) {
  const d = soDigitos(s).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
fm.telefone.addEventListener('input', () => { fm.telefone.value = mascaraTel(fm.telefone.value); });
const lerValor = (s) => {
  const t = String(s || '').trim().replace(/\s|R\$/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
};
const mostrarValor = (n) => n == null ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function ajustarRenda() {
  const sem = fm.renda_tipo.value === 'Sem renda';
  fm.querySelector('[data-campo="renda_valor"]').hidden = sem;
}
fm.renda_tipo.addEventListener('change', ajustarRenda);
const simNao = (nome) => { const r = fm.querySelector(`input[name="${nome}"]:checked`); return r ? r.value === 'sim' : null; };
const marcarSimNao = (nome, v) => { for (const r of fm.querySelectorAll(`input[name="${nome}"]`)) r.checked = v != null && r.value === (v ? 'sim' : 'nao'); };

function lerFormulario() {
  return {
    nome: fm.nome.value.trim(), escolaridade: fm.escolaridade.value, profissao: fm.profissao.value.trim(),
    renda_tipo: fm.renda_tipo.value,
    renda_valor: fm.renda_tipo.value === 'Sem renda' ? 0 : lerValor(fm.renda_valor.value),
    telefone: soDigitos(fm.telefone.value),
    rua: fm.rua.value.trim(), numero: fm.numero.value.trim(), bairro: fm.bairro.value.trim(),
    cadunico: simNao('cadunico'), bolsa_familia: simNao('bolsa_familia')
  };
}
function preencherFormulario(d) {
  fm.nome.value = d.nome || ''; fm.escolaridade.value = d.escolaridade || ''; fm.profissao.value = d.profissao || '';
  fm.renda_tipo.value = d.renda_tipo || '';
  fm.renda_valor.value = d.renda_tipo === 'Sem renda' ? '' : mostrarValor(d.renda_valor);
  fm.telefone.value = mascaraTel(d.telefone); fm.rua.value = d.rua || ''; fm.numero.value = d.numero || '';
  fm.bairro.value = d.bairro || '';
  marcarSimNao('cadunico', d.cadunico); marcarSimNao('bolsa_familia', d.bolsa_familia);
  ajustarRenda();
}
// Mesmas regras do banco (reurb_validar_formulario).
function validar(d) {
  const erros = [];
  if (d.nome.length < 3) erros.push('nome');
  if (!d.escolaridade) erros.push('escolaridade');
  if (d.profissao.length < 2) erros.push('profissao');
  if (!d.renda_tipo) erros.push('renda_tipo');
  if (d.renda_tipo && d.renda_tipo !== 'Sem renda' && !(d.renda_valor > 0)) erros.push('renda_valor');
  if (d.telefone.length < 10 || d.telefone.length > 11) erros.push('telefone');
  if (d.rua.length < 2) erros.push('rua');
  if (!d.numero) erros.push('numero');
  if (d.bairro.length < 2) erros.push('bairro');
  if (d.cadunico == null) erros.push('cadunico');
  if (d.bolsa_familia == null) erros.push('bolsa_familia');
  return erros;
}
function marcarErros(erros) {
  for (const el of fm.querySelectorAll('.campo')) el.classList.toggle('erro', erros.includes(el.dataset.campo));
  if (erros.length) {
    const el = fm.querySelector(`.campo[data-campo="${erros[0]}"]`);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const i = el.querySelector('input,select'); if (i) i.focus({ preventScroll: true }); }
  }
}
for (const el of fm.querySelectorAll('.campo')) {
  el.addEventListener('input', () => el.classList.remove('erro'));
  el.addEventListener('change', () => el.classList.remove('erro'));
}
function travarFormulario(travar) {
  for (const el of fm.querySelectorAll('input,select')) el.disabled = travar;
  $('cad-salvar').hidden = travar;
  $('cad-editar').hidden = !travar;
}

async function abrirFormulario(k) {
  const f = loteK(k); if (!f) return;
  const pin = ler(CHAVE_PIN, null);
  if (!pin) return pedirCodigo('equipe', () => abrirFormulario(k));
  const p = f.properties;
  cadLote = { k, id: p.id, finalizado: p.f === 2 };
  cadCodigoAdmin = null;
  fm.reset(); marcarErros([]); $('cad-msg').textContent = '';
  $('cad-titulo').textContent = `Cadastro · Quadra ${p.q} · Lote ${p.l}`;
  const pendente = filaForm.find((m) => m.id === p.id);
  let nota = '';
  if (pendente) { preencherFormulario(pendente.dados); nota = 'Salvo neste aparelho, aguardando envio ao banco.'; }
  else if (p.f) {
    $('cad-nota').textContent = 'Carregando o cadastro salvo…';
    let r;
    try { r = await comTempo(rpc('reurb_ler_formulario', { p_nucleo: C.dados.nucleo, p_id: p.id, p_pin: pin }), 12000); }
    catch (e) { return aviso(offline(e) ? 'Sem conexão: o cadastro salvo só abre com internet.' : (e.msg || 'Não foi possível abrir o cadastro.'), 6000); }
    if (r.erro === 'pin') { gravar(CHAVE_PIN, null); return pedirCodigo('equipe', () => abrirFormulario(k)); }
    if (r.dados) preencherFormulario(r.dados);
    nota = r.finalizado_em ? `Confirmado pelo administrador em ${fmtData(r.finalizado_em)}.`
                           : `Salvo em ${fmtData(r.atualizado_em)} · aguardando confirmação do administrador.`;
    cadLote.finalizado = !!r.finalizado_em;
  } else {
    // Cadastro novo: endereço já sugerido pela posição do lote
    fm.bairro.value = C.bairro || '';
    fm.rua.value = ruaMaisProxima(f.geometry.coordinates.flat(f.geometry.type === 'MultiPolygon' ? 2 : 1)) || '';
    ajustarRenda();
    nota = p.s === 'CADASTRADO'
      ? 'Este lote foi marcado antes do formulário. Ao salvar, ele volta para “Em cadastramento” até o administrador confirmar.'
      : 'Todos os campos são obrigatórios. Ao salvar, o lote fica “Em cadastramento”.';
  }
  $('cad-nota').textContent = nota;
  travarFormulario(cadLote.finalizado);
  if (cadLote.finalizado) $('cad-nota').textContent += ' Para corrigir, use o código de administrador.';
  $('cad').hidden = false;
  $('cad-corpo').scrollTop = 0;
}
function fecharFormulario() { $('cad').hidden = true; cadLote = null; cadCodigoAdmin = null; fm.reset(); }
$('cad-fechar').onclick = fecharFormulario;
$('cad-editar').onclick = () => pedirCodigo('admin', (cod) => { cadCodigoAdmin = cod; travarFormulario(false); $('cad-msg').textContent = 'Edição liberada pelo administrador.'; });

fm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!cadLote) return;
  const d = lerFormulario();
  const erros = validar(d);
  marcarErros(erros);
  if (erros.length) { $('cad-msg').textContent = 'Preencha os campos destacados.'; return; }
  const { id } = cadLote;
  const em = new Date().toISOString();
  $('cad-salvar').disabled = true; $('cad-msg').textContent = 'Salvando…';
  try {
    if (cadCodigoAdmin || cadLote.finalizado) {
      // Correção pelo administrador: só com internet (o código não fica guardado no aparelho)
      const r = await comTempo(rpc('reurb_salvar_formulario', { p_nucleo: C.dados.nucleo, p_id: id, p_dados: d, p_pin: cadCodigoAdmin }), 15000);
      if (r.erro) { $('cad-msg').textContent = msgErro(r); return; }
      atualizarLote(id, r);
    } else {
      // Equipe: entra na fila do aparelho e segue para o banco (na hora, ou quando o sinal voltar)
      filaForm = filaForm.filter((m) => m.id !== id).concat([{ id, dados: d, em }]);
      gravar(CHAVE_FILA_FORM, filaForm);
      aplicarFila(dados);
    }
    redesenhar();
    fecharFormulario();
    aviso('Cadastro salvo. O lote está em cadastramento até o administrador confirmar.', 5000);
    enviarFila();
  } catch (err) {
    $('cad-msg').textContent = offline(err) ? 'Sem conexão: a correção do administrador precisa de internet.' : (err.msg || 'O banco recusou o cadastro.');
  } finally { $('cad-salvar').disabled = false; }
});

function msgErro(r) {
  return ({
    pin: 'PIN ou código incorreto.', admin: 'Só o código de administrador pode fazer isso.',
    finalizado: 'Este cadastro já foi confirmado; só o administrador pode corrigir.',
    sem_formulario: 'O lote ainda não tem formulário salvo.', lote: 'Este lote não existe mais no banco.',
    campos: 'O banco recusou campos incompletos: ' + (r.campos || []).join(', '),
    formulario: 'A marcação agora é feita pelo formulário do cadastro.'
  })[r.erro] || 'O banco recusou a operação.';
}

// --- Confirmação e remoção (administrador) ---
function finalizar(k) {
  const f = loteK(k); if (!f) return;
  const p = f.properties;
  pedirCodigo('admin', async (cod) => {
    try {
      const r = await comTempo(rpc('reurb_finalizar', { p_nucleo: C.dados.nucleo, p_id: p.id, p_codigo: cod }), 15000);
      if (r.erro) return aviso(msgErro(r), 6000);
      atualizarLote(p.id, r); redesenhar();
      aviso(`Cadastro do lote ${p.l} (quadra ${p.q}) confirmado.`, 4000);
    } catch (e) { aviso(offline(e) ? 'Sem conexão: tente de novo com internet.' : (e.msg || 'Não foi possível confirmar.'), 6000); }
  });
}
function limparMarcacao(k) {
  const f = loteK(k); if (!f) return;
  const p = f.properties;
  pedirCodigo('admin', async (cod) => {
    try {
      const r = await comTempo(rpc('reurb_marcar', { p_nucleo: C.dados.nucleo, p_id: p.id, p_status: '', p_pin: cod }), 15000);
      if (r.erro) return aviso(msgErro(r), 6000);
      atualizarLote(p.id, r); redesenhar();
      aviso('Marcação removida. O formulário, se houver, continua guardado.', 5000);
    } catch (e) { aviso(offline(e) ? 'Sem conexão: tente de novo com internet.' : (e.msg || 'Não foi possível remover.'), 6000); }
  });
}

// --- Envio do que ficou guardado no aparelho ---
let enviando = false;
async function enviarFila() {
  if (!SB || enviando || (!fila.length && !filaForm.length)) return;
  const pin = ler(CHAVE_PIN, null);
  if (!pin) return;
  enviando = true;
  try {
    while (filaForm.length) {
      const m = filaForm[0];
      const r = await comTempo(rpc('reurb_salvar_formulario', { p_nucleo: C.dados.nucleo, p_id: m.id, p_dados: m.dados, p_pin: pin }), 15000);
      if (r && r.erro === 'pin') {
        gravar(CHAVE_PIN, null);
        aviso('PIN da equipe não confere. Abra um lote e salve de novo para digitar o PIN.', 6000);
        break;
      }
      filaForm.shift(); gravar(CHAVE_FILA_FORM, filaForm);
      if (r && r.erro) aviso(`Cadastro do lote de ID ${m.id} não foi salvo: ${msgErro(r)}`, 8000);
      else atualizarLote(m.id, r);
    }
    // Marcações diretas guardadas por versões anteriores da página (antes do formulário)
    while (fila.length && !filaForm.length) {
      const m = fila[0];
      const r = await comTempo(rpc('reurb_marcar', { p_nucleo: C.dados.nucleo, p_id: m.id, p_status: m.s || '', p_pin: pin }), 15000);
      if (r && r.erro === 'pin') { gravar(CHAVE_PIN, null); break; }
      fila.shift(); gravar(CHAVE_FILA, fila);
      if (r && r.erro) aviso(`Marcação do lote de ID ${m.id} não enviada: ${msgErro(r)}`, 6000);
      else atualizarLote(m.id, r);
    }
  } catch (e) {
    if (e.status) aviso(e.msg || 'O banco recusou o envio. Tente de novo em instantes.', 6000);
    // sem sinal: continua guardado no aparelho e segue quando a conexão voltar
  } finally {
    enviando = false;
    if (dados) { aplicarFila(dados); redesenhar(); }
  }
  if (!doBanco && !fila.length && !filaForm.length) await atualizar(false);
}
setInterval(() => { if ((fila.length || filaForm.length) && navigator.onLine) enviarFila(); }, 30000);

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

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
  $('f-acoes2').hidden = !SB;
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
    formulario: 'A marcação agora é feita pelo formulário do cadastro.',
    formato: 'Formato não aceito: use JPG, JPEG, PNG ou PDF.', tamanho: 'Arquivo maior que 15 MB.',
    anexo: 'Anexo não encontrado (talvez já removido).'
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

// ---------- Anexos do cadastro (fotos e documentos no Supabase Storage) ----------
// Regras (garantidas no banco, 04_anexos.sql):
//   · JPG, JPEG, PNG ou PDF até 15 MB; PIN da equipe ou código de administrador.
//   · Cadastro confirmado: só o administrador anexa ou remove.
//   · Os arquivos ficam num bucket privado; só são baixados logo depois de uma consulta feita com PIN/código.
const BUCKET = (C.anexos && C.anexos.bucket) || 'reurb-anexos';
const MAX_BYTES = 15 * 1024 * 1024;
const FOTO_MAX_PX = 2400;            // lado maior das fotos depois de reduzidas
const MIME_OK = ['image/jpeg', 'image/png', 'application/pdf'];
const NOME_MIME = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'application/pdf': 'PDF' };

function cabecalhos(extra) {
  const h = Object.assign({ apikey: C.dados.chaveAnon }, extra || {});
  if (C.dados.chaveAnon.startsWith('eyJ')) h.Authorization = `Bearer ${C.dados.chaveAnon}`;
  return h;
}
const urlObjeto = (cam) => `${C.dados.url}/storage/v1/object/${BUCKET}/${cam.split('/').map(encodeURIComponent).join('/')}`;
const urlLeitura = (cam) => `${C.dados.url}/storage/v1/object/authenticated/${BUCKET}/${cam.split('/').map(encodeURIComponent).join('/')}`;

async function enviarArquivo(cam, blob, mime) {
  const r = await fetch(urlObjeto(cam), { method: 'POST', body: blob,
    headers: cabecalhos({ 'Content-Type': mime, 'x-upsert': 'false', 'cache-control': '31536000' }) });
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; try { e.msg = (await r.json()).message; } catch (_) {} throw e; }
}
async function baixarArquivo(cam) {
  const r = await fetch(urlLeitura(cam), { headers: cabecalhos() });
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return r.blob();
}

// Tipo real do arquivo (alguns aparelhos mandam type vazio ou "image/jpg").
function tipoArquivo(file) {
  const t = (file.type || '').toLowerCase();
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (t === 'image/jpeg' || t === 'image/jpg' || (!t && (ext === 'jpg' || ext === 'jpeg'))) return 'image/jpeg';
  if (t === 'image/png' || (!t && ext === 'png')) return 'image/png';
  if (t === 'application/pdf' || ext === 'pdf') return 'application/pdf';
  if (t.startsWith('image/')) return 'converter';          // HEIC, WebP… da câmera: vira JPG
  return null;
}
// Reduz fotos grandes e converte formatos de câmera para JPG. PNG pequeno e PDF seguem como estão.
async function prepararArquivo(file) {
  const tipo = tipoArquivo(file);
  if (!tipo) throw new Error('Formato não aceito: use JPG, JPEG, PNG ou PDF.');
  if (tipo === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new Error('PDF maior que 15 MB.');
    return { blob: file, mime: tipo, nome: file.name || 'documento.pdf' };
  }
  const grande = file.size > 2.5 * 1024 * 1024;
  if (tipo !== 'converter' && !grande && file.size <= MAX_BYTES) {
    const img = await abrirImagem(file).catch(() => null);
    if (!img || Math.max(img.width, img.height) <= FOTO_MAX_PX) return { blob: file, mime: tipo, nome: file.name || 'foto.jpg' };
  }
  const img = await abrirImagem(file).catch(() => null);
  if (!img) throw new Error('Não foi possível ler a imagem. Tente de novo ou envie como JPG.');
  const s = Math.min(1, FOTO_MAX_PX / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(img, 0, 0, cv.width, cv.height);
  if (img.close) img.close();
  let q = 0.86, blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', q));
  while (blob && blob.size > MAX_BYTES && q > 0.4) { q -= 0.15; blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', q)); }
  if (!blob || blob.size > MAX_BYTES) throw new Error('Imagem maior que 15 MB mesmo reduzida.');
  const base = (file.name || 'foto').replace(/\.[^.]+$/, '');
  return { blob, mime: 'image/jpeg', nome: base + '.jpg' };
}
function abrirImagem(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file, { imageOrientation: 'from-image' });
  return new Promise((ok, erro) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = (e) => { URL.revokeObjectURL(u); erro(e); };
    im.src = u;
  });
}
// Texto curto para um erro de rede, de tempo ou do banco.
const motivo = (e) => e.message === 'tempo' ? 'o banco demorou a responder'
  : e instanceof TypeError ? 'sem conexão' : (e.msg || e.message || 'erro');
const tamanhoTxt = (b) => b > 1048576 ? fmt(b / 1048576, 1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

// --- Janela de anexos de um lote ---
let anxLote = null;          // { k, id, q, l }
let anxCodigoAdmin = null;   // só enquanto a janela está aberta
let anxFinalizado = false;
let anxUrls = [];            // URLs de miniaturas para liberar ao fechar
const msgAnx = (t, erro) => { $('anx-msg').textContent = t || ''; $('anx-msg').classList.toggle('erro', !!erro); };

$('b-anx').onclick = () => { if (selecionado !== null) abrirAnexos(selecionado); };
$('b-zip').onclick = () => { if (selecionado !== null) { const f = loteK(selecionado); if (f) exportarComAdmin([f.properties.id]); } };
$('anx-zip').onclick = () => { if (anxLote) exportarComAdmin([anxLote.id]); };
$('anx-fechar').onclick = fecharAnexos;
$('anx-liberar').onclick = () => pedirCodigo('admin', (cod) => { anxCodigoAdmin = cod; carregarAnexos(); });

async function abrirAnexos(k) {
  const f = loteK(k); if (!f) return;
  if (!navigator.onLine) return aviso('Sem conexão: fotos e documentos precisam de internet.', 5000);
  if (!ler(CHAVE_PIN, null)) return pedirCodigo('equipe', () => abrirAnexos(k));
  const p = f.properties;
  anxLote = { k, id: p.id, q: p.q, l: p.l };
  anxCodigoAdmin = null;
  $('anx-titulo').textContent = `Fotos e documentos · Quadra ${p.q} · Lote ${p.l}`;
  $('anx-desc').value = ''; msgAnx('');
  $('anx').hidden = false;
  carregarAnexos();
}
function fecharAnexos() {
  $('anx').hidden = true; anxLote = null; anxCodigoAdmin = null;
  anxUrls.forEach((u) => URL.revokeObjectURL(u)); anxUrls = [];
}
const codigoAnx = () => anxCodigoAdmin || ler(CHAVE_PIN, null);

async function carregarAnexos() {
  if (!anxLote) return;
  const lote = anxLote;
  $('anx-nota').textContent = 'Carregando…';
  $('anx-lista').innerHTML = '';
  let r;
  try { r = await comTempo(rpc('reurb_anexos_lote', { p_nucleo: C.dados.nucleo, p_id: lote.id, p_pin: codigoAnx() }), 15000); }
  catch (e) { $('anx-nota').textContent = offline(e) ? 'Sem conexão com o banco.' : (e.msg || 'Não foi possível carregar os anexos.'); return; }
  if (anxLote !== lote) return;
  if (r.erro === 'pin') {
    if (anxCodigoAdmin) { anxCodigoAdmin = null; return aviso('Código de administrador incorreto.', 5000); }
    gravar(CHAVE_PIN, null); fecharAnexos(); return pedirCodigo('equipe', () => abrirAnexos(lote.k));
  }
  anxFinalizado = !!r.finalizado;
  const pode = !anxFinalizado || r.papel === 'admin';
  $('anx-novo').hidden = !pode;
  $('anx-liberar').hidden = pode;
  $('anx-nota').textContent = anxFinalizado
    ? (r.papel === 'admin' ? 'Cadastro confirmado · alterações liberadas pelo administrador.' : 'Cadastro confirmado pelo administrador: só ele anexa ou remove.')
    : 'Tire fotos ou anexe documentos deste cadastro. Ficam guardados no banco, ligados ao ID ' + lote.id + '.';
  desenharAnexos(r.anexos || [], pode);
}

function desenharAnexos(lista, pode) {
  const ul = $('anx-lista');
  anxUrls.forEach((u) => URL.revokeObjectURL(u)); anxUrls = [];
  if (!lista.length) { ul.innerHTML = '<li class="vazio">Nenhum anexo ainda.</li>'; return; }
  ul.innerHTML = lista.map((a) => `<li data-id="${esc(a.id)}">
      <button type="button" class="anx-mini" data-abrir="${esc(a.id)}" aria-label="Abrir ${esc(a.nome)}">${a.mime === 'application/pdf' ? 'PDF' : ''}</button>
      <div class="anx-info"><b>${esc(a.categoria)}</b>
        <span>${esc(a.descricao || a.nome)}</span>
        <span>${NOME_MIME[a.mime] || ''} · ${tamanhoTxt(a.tamanho)} · ${fmtData(a.criado_em)}</span></div>
      ${pode ? `<button type="button" class="anx-rem" data-rem="${esc(a.id)}" aria-label="Remover anexo">×</button>` : ''}</li>`).join('');
  const porId = new Map(lista.map((a) => [a.id, a]));
  ul.querySelectorAll('[data-abrir]').forEach((b) => (b.onclick = () => abrirAnexo(porId.get(b.dataset.abrir))));
  ul.querySelectorAll('[data-rem]').forEach((b) => (b.onclick = () => removerAnexo(porId.get(b.dataset.rem))));
  // miniaturas das fotos (baixadas do bucket privado)
  const lote = anxLote;
  for (const a of lista) {
    if (!a.mime.startsWith('image/')) continue;
    baixarArquivo(a.caminho).then((b) => {
      if (anxLote !== lote) return;
      const u = URL.createObjectURL(b); anxUrls.push(u);
      const el = ul.querySelector(`[data-abrir="${CSS.escape(a.id)}"]`); if (el) el.style.backgroundImage = `url("${u}")`;
    }).catch(() => {});
  }
}

async function abrirAnexo(a) {
  if (!a) return;
  const janela = window.open('', '_blank');           // abre já no toque (bloqueadores de pop-up)
  try {
    const b = await baixarArquivo(a.caminho);
    const u = URL.createObjectURL(new Blob([b], { type: a.mime }));
    if (janela) janela.location.href = u; else baixarBlob(new Blob([b], { type: a.mime }), a.nome);
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  } catch (e) {
    if (janela) janela.close();
    aviso('Não foi possível abrir o arquivo. Feche e abra a lista de anexos de novo.', 5000);
  }
}

async function removerAnexo(a) {
  if (!a || !confirm(`Remover "${a.categoria}" (${a.nome}) deste cadastro?`)) return;
  try {
    const r = await comTempo(rpc('reurb_anexo_remover', { p_anexo: a.id, p_pin: codigoAnx() }), 15000);
    if (r.erro) return msgAnx(msgErro(r), true);
    msgAnx('Anexo removido.');
    carregarAnexos();
  } catch (e) { msgAnx(offline(e) ? 'Sem conexão.' : (e.msg || 'Não foi possível remover.'), true); }
}

$('anx-foto').onchange = (e) => { enviarAnexos([...e.target.files]); e.target.value = ''; };
$('anx-arq').onchange = (e) => { enviarAnexos([...e.target.files]); e.target.value = ''; };

async function enviarAnexos(arquivos) {
  if (!anxLote || !arquivos.length) return;
  const lote = anxLote;
  const btns = document.querySelectorAll('.anx-btn');
  btns.forEach((b) => b.classList.add('ocupado'));
  const cat = $('anx-cat').value, desc = $('anx-desc').value.trim();
  let ok = 0; const falhas = [];
  try {
    for (const [i, file] of arquivos.entries()) {
      msgAnx(`Enviando ${arquivos.length > 1 ? `${i + 1} de ${arquivos.length}` : file.name}…`);
      try {
        const prep = await prepararArquivo(file);
        const ini = await comTempo(rpc('reurb_anexo_iniciar', { p_nucleo: C.dados.nucleo, p_id: lote.id, p_nome: prep.nome,
          p_mime: prep.mime, p_tamanho: prep.blob.size, p_categoria: cat, p_descricao: desc, p_pin: codigoAnx() }), 15000);
        if (ini.erro) throw new Error(msgErro(ini));
        await comTempo(enviarArquivo(ini.caminho, prep.blob, prep.mime), 180000);
        const conf = await comTempo(rpc('reurb_anexo_confirmar', { p_anexo: ini.id, p_pin: codigoAnx() }), 15000);
        if (conf.erro) throw new Error(msgErro(conf));
        ok++;
      } catch (e) {
        falhas.push(`${file.name}: ${motivo(e)}`);
      }
    }
  } finally { btns.forEach((b) => b.classList.remove('ocupado')); }
  if (anxLote !== lote) return;
  if (falhas.length) msgAnx(`${ok ? ok + ' enviado(s). ' : ''}Não enviado: ${falhas.join('; ')}`, true);
  else { msgAnx(ok === 1 ? 'Anexo enviado.' : `${ok} anexos enviados.`); $('anx-desc').value = ''; }
  carregarAnexos();
}

// ---------- ZIP (sem compressão: fotos e PDF já são comprimidos) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function montarZip(arquivos) {           // [{ nome: 'pasta/arquivo.ext', dados: Blob|Uint8Array|string }]
  const enc = new TextEncoder(), partes = [], central = [];
  const agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
  const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  let pos = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const d = typeof a.dados === 'string' ? enc.encode(a.dados)
            : a.dados instanceof Uint8Array ? a.dados : new Uint8Array(await a.dados.arrayBuffer());
    const crc = crc32(d);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, hora, true); lh.setUint16(12, data, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, d.length, true); lh.setUint32(22, d.length, true); lh.setUint16(26, nome.length, true); lh.setUint16(28, 0, true);
    partes.push(lh, nome, d);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, hora, true); ch.setUint16(14, data, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, d.length, true); ch.setUint32(24, d.length, true); ch.setUint16(28, nome.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true); ch.setUint32(42, pos, true);
    central.push(ch, nome);
    pos += 30 + nome.length + d.length;
  }
  const tamCentral = central.reduce((s, x) => s + x.byteLength, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
  return new Blob([...partes, ...central, fim], { type: 'application/zip' });
}
function baixarBlob(blob, nome) {
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 120000);
}
const nomeSeguro = (s, max = 100) => String(s || '').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
  .replace(/\s+/g, ' ').trim().replace(/^[. ]+|[. ]+$/g, '').slice(0, max).trim() || 'SEM NOME';

// ---------- Exportação dos cadastros ----------
// Cada cadastro vira "<RESPONSÁVEL> - QD <q> LT <l>.zip" com uma pasta de mesmo nome:
// os anexos e DADOS_CADASTRO.txt. Em bloco: um ZIP com os ZIPs de cada cadastro e a LISTA_CADASTROS.csv.
const loteTxt = (c) => `${c.lote ?? ''}${c.lote_letra || ''}`;
const pastaCadastro = (c) => nomeSeguro(`${(c.dados && c.dados.nome) || 'SEM RESPONSAVEL'} - QD ${c.quadra} LT ${loteTxt(c)}`);
const temCadastro = (c) => !!(c.dados || c.status || (c.anexos && c.anexos.length));
const simNaoTxt = (v) => v === true ? 'Sim' : v === false ? 'Não' : '';
const telTxt = (t) => t ? mascaraTel(t) : '';
const dataTxt = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '';

function textoCadastro(c, nomesAnexos) {
  const d = c.dados || {};
  const L = [];
  const lin = (rot, v) => L.push(`${(rot + ' ').padEnd(32, '.')} ${v == null ? '' : v}`);
  L.push(`CADASTRO REURB - ${C.dados.nucleo}`, `${C.subtitulo || ''}`.replace(' · ', '/'), `Exportado em: ${new Date().toLocaleString('pt-BR')}`, '='.repeat(66), '');
  L.push('IDENTIFICAÇÃO DO LOTE', '-'.repeat(66));
  lin('Quadra', c.quadra); lin('Lote', loteTxt(c)); lin('ID de vínculo', c.id);
  lin('Matrícula', c.matricula || ''); lin('Área (m²)', c.area != null ? fmt(c.area) : ''); lin('Perímetro (m)', c.perimetro != null ? fmt(c.perimetro) : '');
  lin('Situação do cadastro', c.status ? NOME_SIT[c.status] + (c.status_em ? ` (${dataTxt(c.status_em)})` : '') : 'Sem marcação');
  const f = loteId(c.id);
  const med = f ? medirLote(f.geometry) : null;
  if (med) {
    L.push('', 'MEDIDAS DOS LADOS (vértice 1 = mais ao norte, sentido horário)', '-'.repeat(66));
    med.lados.forEach((l) => lin(`Lado ${l.de} - ${l.para}`, txtM(l.m)));
    lin('Soma dos lados', txtM(med.lados.reduce((t, l) => t + l.m, 0)));
  }
  L.push('', 'DADOS DO CADASTRO', '-'.repeat(66));
  if (!c.dados) L.push('Formulário ainda não preenchido.');
  else {
    lin('Nome do responsável', d.nome); lin('Escolaridade', d.escolaridade); lin('Profissão', d.profissao);
    lin('Renda - tipo', d.renda_tipo); lin('Renda - valor mensal', d.renda_tipo === 'Sem renda' ? 'R$ 0,00' : `R$ ${mostrarValor(d.renda_valor)}`);
    lin('Telefone', telTxt(d.telefone));
    lin('Endereço', [d.rua, d.numero].filter(Boolean).join(', ') + (d.bairro ? ` - ${d.bairro}` : ''));
    lin('Tem CadÚnico', simNaoTxt(d.cadunico)); lin('Recebe Bolsa Família', simNaoTxt(d.bolsa_familia));
    lin('Formulário criado em', dataTxt(c.form_criado_em)); lin('Última alteração', `${dataTxt(c.form_atualizado_em)}${c.form_por ? ' (' + c.form_por + ')' : ''}`);
    lin('Confirmado pelo administrador', c.finalizado_em ? dataTxt(c.finalizado_em) : 'Não');
  }
  const an = c.anexos || [];
  L.push('', `ANEXOS (${an.length})`, '-'.repeat(66));
  if (!an.length) L.push('Nenhum anexo.');
  an.forEach((a, i) => {
    const nz = nomesAnexos[i];
    L.push(`${String(i + 1).padStart(2, '0')}. [${a.categoria}] ${nz || 'NÃO BAIXADO: ' + a.nome}`);
    if (a.descricao) L.push(`    Descrição: ${a.descricao}`);
    L.push(`    Anexado em: ${dataTxt(a.criado_em)} · original: ${a.nome}`);
  });
  L.push('');
  return '\ufeff' + L.join('\r\n');
}

async function arquivosDoCadastro(c, renovar) {
  const pasta = pastaCadastro(c);
  const arqs = [], nomes = [], usados = new Set(), falhas = [];
  for (const [i, a] of (c.anexos || []).entries()) {
    let b = null;
    try { b = await baixarArquivo(a.caminho); }
    catch (e) {
      if (e.status && renovar) { try { await renovar(); b = await baixarArquivo(a.caminho); } catch (_) {} }  // liberação venceu
    }
    if (!b) { nomes.push(null); falhas.push(`${pasta}: ${a.nome}`); continue; }
    const ext = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' })[a.mime] || '';
    let nm = nomeSeguro(`${String(i + 1).padStart(2, '0')}_${a.categoria}_${a.nome.replace(/\.[^.]+$/, '')}`, 90) + ext;
    while (usados.has(nm.toLowerCase())) nm = nm.replace(ext, '_' + ext);
    usados.add(nm.toLowerCase());
    arqs.push({ nome: `${pasta}/${nm}`, dados: b });
    nomes.push(nm);
  }
  arqs.push({ nome: `${pasta}/DADOS_CADASTRO.txt`, dados: textoCadastro(c, nomes) });
  return { pasta, arqs, falhas };
}

function csvCadastros(lista) {
  const cel = (v) => { const s = v == null ? '' : String(v); return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const linhas = [['ID_VINCULO', 'QUADRA', 'LOTE', 'RESPONSAVEL', 'TELEFONE', 'SITUACAO', 'FORMULARIO', 'CONFIRMADO_EM', 'ANEXOS', 'AREA_M2', 'PASTA_EXPORTACAO']];
  for (const c of lista) linhas.push([c.id, c.quadra, loteTxt(c), c.dados ? c.dados.nome : '', c.dados ? telTxt(c.dados.telefone) : '',
    c.status ? NOME_SIT[c.status] : '', c.dados ? 'Sim' : 'Não', dataTxt(c.finalizado_em), (c.anexos || []).length,
    c.area != null ? fmt(c.area) : '', pastaCadastro(c)]);
  return '\ufeff' + linhas.map((l) => l.map(cel).join(';')).join('\r\n');
}
const carimbo = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`; };
const NUCLEO_ARQ = nomeSeguro(C.titulo).toUpperCase().replace(/ /g, '_');

async function buscarCadastros(cod, ids) {
  const r = await comTempo(rpc('reurb_cadastros', { p_nucleo: C.dados.nucleo, p_codigo: cod, p_ids: ids || null }), 30000);
  if (r.erro) { const e = new Error(msgErro(r)); e.erroBanco = r.erro; throw e; }
  const n = (v) => (/^\d+$/.test(String(v)) ? Number(v) : 1e6);
  return (r.cadastros || []).sort((a, b) => n(a.quadra) - n(b.quadra) || (a.lote || 0) - (b.lote || 0) || String(a.id).localeCompare(String(b.id)));
}

// Exporta: 1 lote → o ZIP do cadastro; vários → um ZIP com os ZIPs de cada cadastro e a lista CSV.
async function exportar(ids, cod, progresso) {
  const msg = progresso || ((t) => aviso(t, 60000));
  msg('Buscando os cadastros…');
  const lista = await buscarCadastros(cod, ids);
  const alvo = ids ? lista : lista.filter(temCadastro);
  if (!alvo.length) throw new Error('Nenhum cadastro para exportar.');
  const renovar = () => buscarCadastros(cod, alvo.map((c) => c.id));
  const falhas = [];
  if (alvo.length === 1) {
    const c = alvo[0];
    msg(`Baixando ${(c.anexos || []).length} anexo(s)…`);
    const r = await arquivosDoCadastro(c, renovar);
    falhas.push(...r.falhas);
    baixarBlob(await montarZip(r.arqs), r.pasta + '.zip');
  } else {
    const internos = [];
    for (const [i, c] of alvo.entries()) {
      msg(`Exportando ${i + 1} de ${alvo.length}: quadra ${c.quadra}, lote ${loteTxt(c)}…`);
      const r = await arquivosDoCadastro(c, renovar);
      falhas.push(...r.falhas);
      let nome = r.pasta + '.zip', n = 2;
      while (internos.some((x) => x.nome === nome)) nome = `${r.pasta} (${n++}).zip`;
      internos.push({ nome, dados: new Uint8Array(await (await montarZip(r.arqs)).arrayBuffer()) });
    }
    internos.push({ nome: 'LISTA_CADASTROS.csv', dados: csvCadastros(alvo) });
    if (falhas.length) internos.push({ nome: 'AVISOS_EXPORTACAO.txt', dados: '\ufeffAnexos que não puderam ser baixados:\r\n' + falhas.join('\r\n') });
    msg('Montando o arquivo final…');
    baixarBlob(await montarZip(internos), `CADASTROS_${NUCLEO_ARQ}_${carimbo()}.zip`);
  }
  return { total: alvo.length, falhas };
}

let codigoAdminSessao = null;   // código de administrador lembrado só enquanto a página está aberta
function comAdmin(cb) {
  if (codigoAdminSessao) return cb(codigoAdminSessao);
  pedirCodigo('admin', (cod) => { codigoAdminSessao = cod; cb(cod); });
}
function exportarComAdmin(ids) {
  if (!navigator.onLine) return aviso('Sem conexão: a exportação precisa de internet.', 5000);
  comAdmin(async (cod) => {
    try {
      const r = await exportar(ids, cod, (t) => { aviso(t, 60000); if (!$('anx').hidden) msgAnx(t); });
      const t = r.falhas.length ? `Exportado, mas ${r.falhas.length} anexo(s) não baixaram.` : 'Cadastro exportado.';
      aviso(t, 6000); if (!$('anx').hidden) msgAnx(t, !!r.falhas.length);
    } catch (e) {
      if (e.erroBanco === 'pin' || e.erroBanco === 'admin') codigoAdminSessao = null;
      aviso('Exportação não concluída: ' + motivo(e) + '.', 7000);
    }
  });
}

// ---------- Lista dos cadastros (administrador) ----------
let lstDados = [];
const lstSel = new Set();
if (SB) $('b-lista').hidden = false;
$('b-lista').onclick = () => {
  if (!navigator.onLine) return aviso('Sem conexão: a lista de cadastros precisa de internet.', 5000);
  comAdmin(abrirLista);
};
$('lst-fechar').onclick = () => { $('lst').hidden = true; };
$('lst-busca').oninput = desenharLista;
$('lst-filtro').onchange = desenharLista;
const lstMsg = (t, erro) => { $('lst-msg').textContent = t || ''; $('lst-msg').classList.toggle('erro', !!erro); };

async function abrirLista(cod) {
  $('lst').hidden = false; lstMsg('');
  $('lst-nota').textContent = 'Carregando…';
  $('lst-corpo').innerHTML = '';
  try { lstDados = await buscarCadastros(cod, null); }
  catch (e) {
    if (e.erroBanco === 'pin' || e.erroBanco === 'admin') { codigoAdminSessao = null; $('lst').hidden = true; return aviso(e.message, 6000); }
    $('lst-nota').textContent = 'Não foi possível carregar: ' + motivo(e) + '.';
    return;
  }
  lstSel.clear();
  const comCad = lstDados.filter(temCadastro).length;
  const anx = lstDados.reduce((s, c) => s + (c.anexos || []).length, 0);
  $('lst-nota').textContent = `${lstDados.length} lotes · ${comCad} com cadastro · ${anx} anexo(s). Toque numa linha para ver o lote no mapa.`;
  desenharLista();
}

function filtrados() {
  const f = $('lst-filtro').value;
  const busca = $('lst-busca').value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return lstDados.filter((c) => {
    if (f === 'cad' && !temCadastro(c)) return false;
    if (f === 'anx' && !(c.anexos || []).length) return false;
    if (f === 'emc' && c.status !== 'EM CADASTRAMENTO') return false;
    if (f === 'ok' && c.status !== 'CADASTRADO') return false;
    if (f === 'sem' && temCadastro(c)) return false;
    if (!busca) return true;
    const alvo = `${(c.dados && c.dados.nome) || ''} q${c.quadra} l${loteTxt(c)} ${c.quadra}-${loteTxt(c)} ${c.id}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return busca.split(/\s+/).every((t) => alvo.includes(t));
  });
}

function desenharLista() {
  const lista = filtrados();
  $('lst-corpo').innerHTML = lista.length ? lista.map((c) => {
    const sit = c.status ? `<span class="sit ${c.status === 'CADASTRADO' ? 'cad' : 'emc'}">${NOME_SIT[c.status]}</span>` : '<span class="sit nada">—</span>';
    return `<tr data-id="${esc(c.id)}"><td><input type="checkbox" data-sel="${esc(c.id)}" ${lstSel.has(c.id) ? 'checked' : ''} aria-label="Selecionar"></td>
      <td class="num">${esc(c.quadra)} · ${esc(loteTxt(c))}</td><td class="nome">${esc((c.dados && c.dados.nome) || '—')}</td>
      <td>${sit}</td><td class="num">${(c.anexos || []).length || ''}</td></tr>`;
  }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--suave);padding:20px">Nenhum lote neste filtro.</td></tr>';
  $('lst-todos').checked = lista.length > 0 && lista.every((c) => lstSel.has(c.id));
  atualizarBotoesLista();
}
function atualizarBotoesLista() {
  $('lst-sel').disabled = !lstSel.size;
  $('lst-sel').textContent = lstSel.size ? `Exportar selecionados (${lstSel.size})` : 'Exportar selecionados';
  const n = filtrados().length;
  $('lst-tudo').textContent = `Exportar ${$('lst-filtro').value === 'todos' ? 'todos' : 'os listados'} (${n})`;
  $('lst-tudo').disabled = !n;
}
$('lst-corpo').addEventListener('click', (e) => {
  const cb = e.target.closest('[data-sel]');
  if (cb) { cb.checked ? lstSel.add(cb.dataset.sel) : lstSel.delete(cb.dataset.sel); $('lst-todos').checked = false; atualizarBotoesLista(); return; }
  const tr = e.target.closest('tr[data-id]'); if (!tr) return;
  const f = loteId(tr.dataset.id); if (!f) return aviso('Lote não está no mapa carregado.', 4000);
  $('lst').hidden = true;
  selecionar(f.properties.k); abrirFicha(f.properties); enquadrarLote(f);
});
$('lst-todos').onchange = (e) => {
  for (const c of filtrados()) e.target.checked ? lstSel.add(c.id) : lstSel.delete(c.id);
  desenharLista();
};
$('lst-csv').onclick = () => {
  const lista = filtrados();
  if (!lista.length) return lstMsg('Nada para listar neste filtro.', true);
  baixarBlob(new Blob([csvCadastros(lista)], { type: 'text/csv;charset=utf-8' }), `LISTA_CADASTROS_${NUCLEO_ARQ}_${carimbo()}.csv`);
  lstMsg(`Lista com ${lista.length} lote(s) baixada.`);
};
async function exportarDaLista(ids) {
  const bts = ['lst-sel', 'lst-tudo', 'lst-csv'].map($);
  bts.forEach((b) => (b.disabled = true));
  try {
    const r = await exportar(ids, codigoAdminSessao, (t) => lstMsg(t));
    lstMsg(r.falhas.length ? `${r.total} cadastro(s) exportado(s); ${r.falhas.length} anexo(s) não baixaram (veja AVISOS_EXPORTACAO.txt).`
                           : `${r.total} cadastro(s) exportado(s).`, !!r.falhas.length);
  } catch (e) {
    if (e.erroBanco === 'pin' || e.erroBanco === 'admin') codigoAdminSessao = null;
    lstMsg('Exportação não concluída: ' + motivo(e) + '.', true);
  } finally { bts.forEach((b) => (b.disabled = false)); atualizarBotoesLista(); }
}
$('lst-sel').onclick = () => exportarDaLista([...lstSel]);
$('lst-tudo').onclick = () => {
  const lista = filtrados();
  if (lista.length > 1 && !confirm(`Exportar ${lista.length} cadastro(s) num único arquivo ZIP? Pode demorar se houver muitas fotos.`)) return;
  exportarDaLista(lista.map((c) => c.id));
};
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('dlg').hidden) return;
  if (!$('anx').hidden) fecharAnexos(); else if (!$('lst').hidden) $('lst').hidden = true;
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

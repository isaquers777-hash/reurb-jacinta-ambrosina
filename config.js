// Configuração do mapa. Só este arquivo muda entre núcleos ou ao trocar a fonte dos dados.
window.APP_CONFIG = {
  titulo: 'Bairro Jacinta Ambrosina',
  subtitulo: 'Setubinha · MG',

  // Ortofoto em PMTiles (tiles WebP). Pode ser o arquivo do próprio site ou uma URL do Cloudflare R2.
  ortofoto: 'data/ortofoto.pmtiles',

  // Imagem de satélite de apoio, fora da área da ortofoto. Desligada em modo "economia de dados".
  satelite: true,

  // Camadas vetoriais: PostGIS no Supabase (edição pelo QGIS aparece aqui ao recarregar).
  dados: {
    tipo: 'supabase',
    url: 'https://jkvxudldoepbouqgfper.supabase.co',
    chaveAnon: 'sb_publishable_Vm16mgybtfZ55bkjn9AW6Q__N9OQy4l', // chave pública: só executa nucleo_geojson
    funcao: 'nucleo_geojson',
    nucleo: 'BAIRRO JACINTA AMBROSINA',
    // Cópia usada se o Supabase não responder (projeto pausado, sem sinal etc.)
    reserva: 'data/nucleo.geojson'
  },

  // Enquadramento inicial [oeste, sul, leste, norte] (WGS84)
  limites: [-42.16698, -17.59726, -42.16090, -17.59267]
};

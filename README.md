# Mapa web — Bairro Jacinta Ambrosina (Setubinha-MG)

Página estática, sem servidor. Abre rápido em dados móveis e mostra a posição do GPS em tempo real.

## O que tem aqui

| Arquivo | Para quê |
|---|---|
| `index.html`, `style.css`, `app.js` | a página |
| `config.js` | **o único arquivo que muda**: título, URL da ortofoto e fonte dos lotes |
| `data/nucleo.geojson` | lotes, quadras e limite do núcleo (21 KB comprimido) |
| `data/ortofoto.pmtiles` | ortofoto em tiles WebP 512 px, zoom 13–21 (~3,6 cm/px), 58 MB |
| `lib/` | MapLibre GL 4.7.1 e PMTiles 3.2.1, servidos junto (não depende de CDN) |
| `fonts/` | fontes dos rótulos (Noto Sans, licença OFL) |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | guarda o app no aparelho e permite "Adicionar à tela inicial" |
| `servidor_local.py` | para testar no computador |

## Testar no computador

O PMTiles precisa de um servidor que aceite leitura por faixa de bytes (Range). Na pasta `webmap`:

```
python servidor_local.py . 8080
```

Abra http://127.0.0.1:8080. O GPS só funciona em HTTPS ou em `127.0.0.1`/`localhost`.

## Publicar no GitHub Pages (grátis)

1. Crie um repositório público (ex.: `reurb-jacinta-ambrosina`) e envie **todo o conteúdo desta pasta**, menos `servidor_local.py`.
   O `ortofoto.pmtiles` tem 58 MB: o GitHub avisa acima de 50 MB, mas aceita até 100 MB por arquivo.
2. *Settings → Pages → Branch: main / (root) → Save*.
3. O endereço fica `https://SEU-USUARIO.github.io/reurb-jacinta-ambrosina/`. Já é HTTPS, então o GPS funciona.

O GitHub Pages aceita Range e comprime JS/CSS/GeoJSON sozinho.

## Quando passar a ortofoto para o Cloudflare R2

Vale a pena quando houver vários núcleos ou ortofotos acima de 100 MB:

1. Envie o `.pmtiles` para o bucket e ative o acesso público (URL `https://pub-....r2.dev/...`).
2. Em *Settings → CORS policy* do bucket:
   ```json
   [{"AllowedOrigins":["https://SEU-USUARIO.github.io"],"AllowedMethods":["GET","HEAD"],
     "AllowedHeaders":["range","if-match"],"ExposeHeaders":["etag","content-range","content-length"],"MaxAgeSeconds":86400}]
   ```
3. Troque `ortofoto:` no `config.js` pela URL do R2 e apague `data/ortofoto.pmtiles` do repositório.

## Ligar ao Supabase (PostGIS)

Quando os lotes estiverem no Supabase, mude o bloco `dados` do `config.js` para `tipo: 'supabase'`
com a URL do projeto, a chave *anon* e o nome da função SQL que devolve o GeoJSON do núcleo.
A página não precisa de mais nenhuma alteração: os campos usados são `t` (L=lote, Q=quadra, R=rótulo da quadra, N=núcleo),
`id` (ID_VINCULO), `q` (quadra), `l` (lote), `a` (área m²) e `p` (perímetro m).

## Uso em campo

- **Botão de seta:** 1º toque liga o GPS e acompanha você; arrastar o mapa solta o acompanhamento; tocar de novo volta a acompanhar; mais um toque desliga.
- A tela fica acesa enquanto o GPS está ligado. O cone azul indica o rumo (bússola parado, GPS andando).
- O círculo azul claro é a precisão informada pelo aparelho (± m no canto).
- **Tocar num lote** mostra quadra, lote, área, perímetro e ID vínculo.
- **Camadas:** liga/desliga ortofoto, satélite de apoio (Esri, fora da área do drone) e números dos lotes.
  Com "economia de dados" ativada no celular, o satélite começa desligado.

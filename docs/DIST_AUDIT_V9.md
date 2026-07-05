# Mapa 2 — Auditoría de `dist` V9

**Fase:** V9 — UI/UX final estilo Apple  
**Fecha de validación:** 2026-07-05  
**Base de partida:** V8 — Deploy profesional en Cloudflare Pages Free validado  
**Resultado:** sin errores bloqueantes para Cloudflare Pages Free.

## Resultado de build

- `dist` generado: `True`
- Archivos en `dist`: `309`
- Tamaño total de `dist`: `182.7373 MiB`
- Mayor asset: `data/business/ventas_mensuales.csv` — `14.0001 MiB`
- Archivos mayores a 25 MiB: `0`
- Archivos no aptos para producción (`.gpkg`, `.sqlite`, `.db`, `.zip`, backups): `0`
- `_headers` copiado a `dist`: `True`
- `_redirects` copiado a `dist`: `False`
- `404.html` en raíz de `dist`: `False`

## Top 10 archivos más grandes

| Archivo | Tamaño |
|---|---:|
| `data/business/ventas_mensuales.csv` | 14.0001 MiB |
| `data/localidades_poligonos_fracciones.geojson` | 10.6115 MiB |
| `data/provincias/provincia_14_cordoba/radios.geojson` | 9.9323 MiB |
| `data/provincias/provincia_82_santa_fe/radios.geojson` | 7.9628 MiB |
| `data/provincias/provincia_02_ciudad_autonoma_de_buenos_aires/radios.geojson` | 5.6628 MiB |
| `data/provincias/provincia_30_entre_rios/radios.geojson` | 4.8877 MiB |
| `data/provincias/provincia_06_buenos_aires/puntos.geojson` | 4.2972 MiB |
| `data/provincias/provincia_06_buenos_aires/fracciones.geojson` | 3.9878 MiB |
| `data/localidades_poligonos_gobiernos_locales.geojson` | 3.7555 MiB |
| `data/provincias/provincia_50_mendoza/radios.geojson` | 3.5161 MiB |

## Validaciones ejecutadas

- `npm install`: OK — 0 vulnerabilidades.
- `npm run build`: OK — `tsc -b`, `vite build` y `scripts/check_cloudflare_dist.mjs` sin errores bloqueantes.
- `npm run dev`: OK — `/`, `/data/metadata.json` y `/favicon.svg` respondieron 200 en smoke test local.
- `npm run preview`: OK — `/`, `/data/metadata.json`, `/data/business/metadata_business_v6.json` y `/favicon.svg` respondieron 200.
- Etiqueta visual: OK — `MAPA 2 · V9`.
- Formularios: OK — se agregaron `id` y `name` a inputs/selects principales.

## Decisión sobre `_redirects`

Se mantiene la decisión de V8: no se agregó `_redirects` porque Mapa 2 se publica como SPA completa sin `404.html` en raíz. No hay cambio funcional en routing durante V9.

## Decisión sobre `_headers`

Se conserva `public/_headers` con headers básicos y cache largo para `/assets/*`, porque los assets generados por Vite tienen hash de contenido.

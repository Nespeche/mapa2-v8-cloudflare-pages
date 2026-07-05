# Mapa 2 — Auditoría de `dist` V8
**Fase:** V8 — Deploy profesional en Cloudflare Pages Free  
**Fecha de validación:** 2026-07-05  
**Base de partida:** V7.1 — Frontend runtime fix validado  
**Resultado:** sin errores bloqueantes para Cloudflare Pages Free.

## Resultado de build

- `dist` generado: `True`
- Archivos en `dist`: `309`
- Tamaño total de `dist`: `182.7297 MiB`
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

- `npm_install`: OK — added 51 packages, audited 52 packages, 0 vulnerabilities
- `npm_run_dev`: OK — Vite ready on http://127.0.0.1:5173/; /, /data/metadata.json y /favicon.svg respondieron 200
- `npm_run_build`: OK — tsc -b, vite build y scripts/check_cloudflare_dist.mjs sin errores bloqueantes
- `npm_preview`: OK — /, /data/metadata.json, /data/business/metadata_business_v6.json, /favicon.svg y asset JS respondieron 200

## Decisión sobre `_redirects`

No se agregó `_redirects` porque Mapa 2 V8 es una SPA completa sin `404.html` de nivel raíz. Cloudflare Pages aplica comportamiento SPA automáticamente en ese caso. Agregar una regla catch-all como `/* /index.html 200` puede interferir con assets propios si se usa incorrectamente.

## Decisión sobre `_headers`

Se agregó `public/_headers` con headers básicos de seguridad y cache largo solo para `/assets/*`, porque esos archivos son generados por Vite con hash de contenido. No se forzó cache largo para `/data/*` para evitar datos obsoletos entre despliegues.

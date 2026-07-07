# Mapa 2 — Auditoría de `dist` V10

**Fase:** V10 — Optimización avanzada de performance, GeoJSON y carga de datos  
**Generado:** 2026-07-07T10:59:13.663Z  
**Base:** V9 aprobada — commit informado 985782d  
**Resultado:** sin errores bloqueantes para Cloudflare Pages Free

## Resultado de build

- `dist` generado: `true`
- Archivos en `dist`: `310`
- Tamaño total de `dist`: `168.7846 MiB`
- Mayor asset: `data/business/ventas_mensuales.csv` — `14.0001 MiB`
- Archivos mayores a 25 MiB: `0`
- Archivos no aptos para producción: `0`
- Archivos raw/output en producción: `0`
- `_headers` copiado a `dist`: `true`
- `_redirects` copiado a `dist`: `false`

## Top 10 archivos más grandes

| Archivo | Tamaño |
|---|---:|
| `data/business/ventas_mensuales.csv` | 14.0001 MiB |
| `data/localidades_poligonos_fracciones.geojson` | 9.7286 MiB |
| `data/provincias/provincia_14_cordoba/radios.geojson` | 9.2504 MiB |
| `data/provincias/provincia_82_santa_fe/radios.geojson` | 7.4155 MiB |
| `data/provincias/provincia_02_ciudad_autonoma_de_buenos_aires/radios.geojson` | 5.2865 MiB |
| `data/provincias/provincia_30_entre_rios/radios.geojson` | 4.5437 MiB |
| `data/provincias/provincia_06_buenos_aires/puntos.geojson` | 4.0444 MiB |
| `data/provincias/provincia_06_buenos_aires/fracciones.geojson` | 3.6878 MiB |
| `data/localidades_poligonos_gobiernos_locales.geojson` | 3.4197 MiB |
| `data/provincias/provincia_50_mendoza/radios.geojson` | 3.2745 MiB |

## Peso por extensión

| Extensión | Archivos | Tamaño |
|---|---:|---:|
| `.geojson` | 287 | 148.7984 MiB |
| `.csv` | 1 | 14.0001 MiB |
| `.json` | 12 | 4.3046 MiB |
| `.js` | 2 | 1.2099 MiB |
| `.png` | 3 | 0.3911 MiB |
| `.css` | 1 | 0.0779 MiB |
| `.md` | 1 | 0.0010 MiB |
| `.html` | 1 | 0.0007 MiB |
| `[sin extension]` | 1 | 0.0005 MiB |
| `.svg` | 1 | 0.0003 MiB |

## Optimizaciones V10 verificadas

- Code splitting: MapView/MapLibre se cargan por import dinámico.
- clientes.geojson sale de la carga inicial y se solicita solo en capas clientes/clusters/heatmap.
- Cache en memoria para JSON/text fetch: evita refetch al alternar capas/filtros.
- Actualización granular de sources MapLibre: reduce setData innecesarios.
- Minificación lossless de JSON/GeoJSON públicos: reduce peso raw de dist sin alterar datos.
- Uso de agregados cliente/departamento V10 para evitar CSV detallado en filtros que no lo requieren.
- Headers de cache moderado para /data/* y cache largo inmutable para /assets/*.

## Advertencias

- Sin advertencias relevantes.

## Errores bloqueantes

- Sin errores bloqueantes.

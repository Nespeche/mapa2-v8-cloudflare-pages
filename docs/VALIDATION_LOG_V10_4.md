# Mapa 2 — Validation Log V10.4

**Fase:** V10.4 — Decisión de arquitectura de carga de datos y backend  
**Base:** V10.3 aprobada  
**Fecha:** 2026-07-07  
**Entorno:** sandbox Linux con Node/npm disponibles. El ZIP no incluía `.git`, por eso `git status` y `git log --oneline -5` no son ejecutables sobre la extracción local.

## Validaciones ejecutadas

| Comando | Resultado |
|---|---:|
| `npm install` | OK — 0 vulnerabilidades |
| `npm run check:client-counts` | OK — clientes=2000, departamentos_con_clientes=268, Bolívar=7 |
| `npm run check:data-contracts` | OK — required_files=18, public_files=301 |
| `npm run check:business-contracts` | OK — clientes=2000, productos=65, ventas_csv=128998, Bolívar=7 |
| `npm run check:geo-contracts` | OK — provincias=24, departamentos_ids=529 |
| `npm run check:map-smoke` | OK |
| `npm run build` | OK |
| `npm run check:cloudflare` | OK — sin errores bloqueantes |
| `npm run audit:dist` | OK |
| `npm run audit:architecture` | OK |
| `npm run audit:data-loading` | OK |
| `npm run audit:dependencies` | OK |
| `npm run validate:architecture` | OK |
| `npm run validate:release` | OK |
| `npm run validate:v10.4` | OK |
| `npm run preview -- --port 4173` | OK — HTTP 200 en `/` |

## Build Vite

- `dist/index.html`: 0.68 kB gzip 0.41 kB
- CSS principal: 81.69 kB gzip 13.28 kB
- JS principal: 230.09 kB gzip 70.78 kB
- Chunk lazy `MapView`: 1,038.62 kB gzip 276.24 kB

## Auditoría de dist

- Archivos en `dist`: 310
- Tamaño total `dist`: 168.7846 MiB
- Mayor asset: `data/business/ventas_mensuales.csv` — 14.0001 MiB
- Assets mayores a 25 MiB: 0
- Errores bloqueantes Cloudflare: 0

## Auditoría de carga de datos

- Carga inicial conocida: 1.5631 MiB
- Lazy conocido: 18.2304 MiB
- `public/data`: 301 archivos, 167.1042 MiB
- Radios publicados: 23 archivos, 59.6659 MiB
- `clientes.geojson`: bajo demanda
- `ventas_mensuales.csv`: bajo demanda
- Radios nacionales: no cargados al inicio

## Auditoría de dependencias

- Dependencias producción: 3
- Dependencias desarrollo: 5
- `requirements.txt` en raíz: no
- `tools/python/requirements.txt`: sí
- Backend implementado: no
- Archivos `.env` privados detectados: 0

## Preview local

Se inició `npm run preview -- --port 4173` y se validó:

- `http://127.0.0.1:4173/` → HTTP 200
- assets JS/CSS principales → HTTP 200
- `data/metadata.json` → HTTP 200
- `data/provincias.geojson` → HTTP 200
- `data/indexes/provincias_index.json` → HTTP 200
- `data/business/metadata_business_v6.json` → HTTP 200
- `data/business/agregados/ventas_cliente_totales.json` → HTTP 200
- `data/business/clientes.geojson` → HTTP 200 bajo demanda

## Validaciones manuales pendientes del usuario

Estas validaciones requieren navegador real:

1. mapa visible;
2. clientes > 0;
3. ventas > 0;
4. selección Buenos Aires;
5. clientes activados;
6. clusters activados;
7. heatmap activado;
8. filtro por producto;
9. CSV detallado carga solo cuando corresponde;
10. Network filtrado por 404 sin assets propios faltantes;
11. consola sin errores rojos bloqueantes;
12. ausencia de loading persistente.

## Conclusión

La validación técnica local de V10.4 es correcta. La versión preserva V10.3 y no implementa backend. Queda pendiente la validación visual/manual en navegador y el build log de Cloudflare para confirmar que ya no se ejecuta `pip install -r requirements.txt`.

# Mapa 2 — Changelog V10

**Fase:** V10 — Optimización avanzada de performance, GeoJSON y carga de datos  
**Base:** V9 aprobada como versión estable.  
**Fecha:** 2026-07-05

## Decisión técnica

V10 se implementa como una fase estrictamente frontend/estática, sin backend y sin alterar el modelo territorial `País → Provincia → Localidad`. El alcance se concentra en optimización incremental, reversible y medible sobre la V9 aprobada.

## Cambios implementados

### 1. Bundle y carga del mapa

- Se cambió `MapView` a import dinámico con `React.lazy`.
- MapLibre queda separado en un chunk diferido junto con el componente de mapa.
- El bundle inicial baja de un único JS de `1,256.90 kB` a un JS inicial de `223.22 kB`.
- Se mantiene fallback visual sin degradar la UI/UX V9.

### 2. Carga inicial de datos

- `clientes.geojson` ya no forma parte de `loadInitialData()`.
- La geometría de clientes se carga solo cuando el usuario activa:
  - `Clientes`,
  - `Clusters`,
  - `Heatmap`.
- La carga inicial aproximada de datos de app baja de `3.8863 MiB` a `1.5631 MiB`.

### 3. Cache en memoria

- Se agregó cache de promesas para `fetchJson` y `fetchText`.
- Evita volver a pedir recursos ya cargados al alternar capas, provincias o filtros.
- En caso de error, el recurso se elimina del cache para permitir reintento.

### 4. MapLibre y renders

- Se separó la actualización de sources por tipo:
  - provincias,
  - departamentos,
  - clientes,
  - localidades.
- Esto evita ejecutar `setData` sobre todas las sources cuando cambia solo una capa.

### 5. Datos públicos

- Se agregó `scripts/minify_public_data_v10.mjs`.
- Se minificaron `299` archivos `.json`/`.geojson` de `public/data` de manera lossless.
- Ahorro total: `13.96 MiB`.
- No se modificaron registros, geometrías, ids, propiedades ni valores.

### 6. CSV detallado bajo demanda

- Se ajustó la decisión de cuándo cargar `ventas_mensuales.csv`.
- Filtros resolubles por agregados cliente o departamento ya no fuerzan el CSV.
- El CSV se conserva para filtros que requieren detalle granular, especialmente producto/categoría o cruces con período y cliente.

### 7. Cloudflare Pages

- Se mantiene `npm run build` como build command.
- Se mantiene `dist` como output directory.
- Se conserva deploy estático.
- No se agregan Workers, Pages Functions, D1, R2 ni KV.
- `_headers` agrega cache moderado para `/data/*`.

### 8. Auditorías livianas

- Se agregó `scripts/audit_dist_v10.mjs`.
- `npm run build` genera:
  - `docs/DIST_AUDIT_V10.json`,
  - `docs/DIST_AUDIT_V10.md`.

## Archivos modificados principales

```text
README.md
index.html
package.json
package-lock.json
public/_headers
src/app/App.tsx
src/app/styles.css
src/components/KpiCards.tsx
src/components/MapView.tsx
src/data/dataClient.ts
src/data/dataPaths.ts
src/types/business.ts
src/utils/aggregations.ts
scripts/audit_dist_v10.mjs
scripts/minify_public_data_v10.mjs
docs/CHANGELOG_V10.md
docs/RUNBOOK_V10_PERFORMANCE.md
docs/PERFORMANCE_CHECKLIST_V10.md
docs/VALIDATION_LOG_V10.txt
```

## Métricas antes/después

| Métrica | V9 | V10 | Resultado |
|---|---:|---:|---:|
| `dist` total | 182.7373 MiB | 168.7777 MiB | -13.9596 MiB |
| Archivos en `dist` | 309 | 311 | +2 por code splitting |
| JS inicial | 1,256.90 kB | 223.22 kB | -1,033.68 kB |
| JS inicial gzip | 343.56 kB | 68.95 kB | -274.61 kB |
| Datos iniciales aproximados | 3.8863 MiB | 1.5631 MiB | -2.3232 MiB |
| `clientes.geojson` | inicial | lazy | mejora |
| Archivos > 25 MiB | 0 | 0 | OK |

## Riesgos pendientes

- `ventas_mensuales.csv` sigue siendo el mayor asset individual (`14.00 MiB`), aunque se mantiene bajo demanda.
- Radios y fracciones siguen ocupando la mayor parte del peso total de `dist`; no se simplificaron topologías para no arriesgar calidad territorial en V10.
- Para una futura V11/V12 se recomienda medir con Lighthouse/DevTools en navegador real y capturar métricas de interacción, no solo auditoría estática.

## Conclusión técnica

La versión V10 es funcional según validaciones locales y reduce peso/carga inicial sin romper V9. No se avanzó a V11.

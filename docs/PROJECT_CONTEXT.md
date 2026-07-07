# Mapa 2 — Project Context actualizado V10.3

**Versión actual de trabajo:** V10.3 — Estabilización, contratos de datos y anti-regresión.  
**Base inmediata:** V10.2 — fix de visibilidad/conteo de clientes.  
**Modelo territorial vigente:** `País → Provincia → Localidad`.

Este documento reemplaza la narrativa antigua que dejaba a V6/V7 como etapa vigente. V6 y V7.1 son bases preservadas, no la fase actual.

---

## Estado preservado

```text
V5.1 — datos censales/geográficos map-ready y compatibles Cloudflare/Windows
V6   — datos comerciales sintéticos de autopartes
V7.1 — frontend runtime fix
V8   — deploy Cloudflare Pages Free
V9   — UI/UX profesional estilo Apple
V10  — performance y carga progresiva
V10.1 — fix visibilidad del mapa
V10.2 — fix conteo/visibilidad de clientes
V10.3 — estabilización, contratos internos y anti-regresión
```

---

## Decisión de arquitectura V10.3

Se mantiene arquitectura estática y liviana:

- Vite + React + TypeScript.
- MapLibre cargado bajo demanda por `React.lazy`.
- Datos públicos en `public/data`.
- Carga inicial limitada a metadata, provincias, índices, productos, calendario, agregados provincia/mes y cliente total.
- Carga bajo demanda para clientes, departamentos, localidades, producto/mes y CSV detallado.
- Sin backend en V10.3.
- Sin regeneración de V5.1/V6.

La decisión recomendada es estabilizar primero con contratos de datos y checks anti-regresión antes de evaluar backend o carga avanzada.

---

## Contratos internos agregados

```text
src/domain/appVersion.ts
src/domain/businessContracts.ts
src/domain/geoContracts.ts
src/domain/dataContracts.ts
src/data/dataManifest.ts
src/data/dataValidators.ts
src/services/commercialMetrics.ts
src/services/filterEngine.ts
src/services/geoEnrichment.ts
```

`src/utils/aggregations.ts` se conserva por compatibilidad. Los nuevos servicios funcionan como wrappers progresivos para evitar una migración riesgosa.

---

## Scripts de control V10.3

```powershell
npm run check:client-counts
npm run check:data-contracts
npm run check:business-contracts
npm run check:geo-contracts
npm run check:map-smoke
npm run build
npm run validate:release
```

---

## Plan posterior documentado

```text
V10.3 — Estabilización, contratos de datos y anti-regresión.
V10.4 — Decisión de arquitectura de carga de datos y backend.
V11 — Implementación de carga de datos/backend si se justifica.
V12 — Refactor y mejora profesional del frontend.
V13 — Analytics comercial avanzado y storytelling.
V14 — Producto final, documentación pública y mantenimiento.
```

Backend no se implementa automáticamente. Primero debe decidirse si conviene mantener Cloudflare Pages estático o sumar R2, Pages Functions, Workers, D1, Railway/Postgres/PostGIS u otra alternativa. Railway/PostGIS solo conviene si aparecen consultas geoespaciales dinámicas reales.

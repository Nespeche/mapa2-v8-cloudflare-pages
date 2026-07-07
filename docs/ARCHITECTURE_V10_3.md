# Mapa 2 — Arquitectura V10.3

> **Nota V10.4:** este documento queda como registro histórico de V10.3. La versión funcional vigente es V10.4 sobre V10.3 aprobada.


**Fase:** V10.3 — Estabilización, contratos de datos y anti-regresión  
**Base:** V10.2 funcional  
**Decisión:** no rehacer arquitectura completa; estabilizar con contratos y capas progresivas.

---

## Diagnóstico inicial

La estructura V10.2 ya era funcional y no justificaba un rewrite completo. Los problemas recientes —mapa oculto y clientes en 0— fueron regresiones de integración, no fallas estructurales que requirieran rehacer desde cero.

Se detectó una contradicción documental: `README.md` estaba cerca de V10.2, pero `docs/PROJECT_CONTEXT.md` y `SKILL.md` conservaban narrativa de V6/V7 como fase vigente. V10.3 actualiza esos documentos para reflejar que la versión actual es V10.3 sobre V10.2.

---

## Arquitectura conservada

```text
src/app/              App React, estado de filtros, KPIs y carga bajo demanda
src/components/       UI, controles, mapa, paneles y tooltips
src/map/              bounds y estilo base MapLibre
src/types/            contratos TypeScript existentes
src/utils/            lógica agregada histórica preservada
public/data/          datos V5.1/V6 listos para frontend
scripts/              checks, auditorías y validaciones reproducibles
```

---

## Capas agregadas en V10.3

```text
src/domain/
  appVersion.ts          versión actual, orden posterior y guardas de release
  businessContracts.ts   conteos esperados, período y semántica KPI
  geoContracts.ts        contrato V5.1, Cloudflare y carga geográfica
  dataContracts.ts       contrato agregado app + negocio + geo

src/services/
  commercialMetrics.ts   wrapper estable sobre agregaciones comerciales
  filterEngine.ts        wrapper estable para decisión de filtros/carga detallada
  geoEnrichment.ts       wrapper estable para enriquecimiento GeoJSON

src/data/
  dataManifest.ts        rutas iniciales/lazy centralizadas
  dataValidators.ts      validadores runtime sin dependencias nuevas
```

---

## Por qué no se hizo un rewrite

Un rewrite completo agregaría riesgo de romper funcionalidades validadas: MapLibre visible, KPIs, clientes, filtros, V5.1, V6, V8, V9 y V10. La decisión profesional es migrar por estrangulamiento: crear contratos y servicios, mantener compatibilidad temporal con `src/utils/aggregations.ts` y mover lógica solo cuando los checks permitan medir regresiones.

---

## Carga de datos preservada

### Inicio

- `data/metadata.json`
- `data/provincias.geojson`
- `data/indexes/provincias_index.json`
- `data/business/metadata_business_v6.json`
- `data/business/agregados/ventas_provincia_mes.json`
- `data/business/agregados/ventas_cliente_totales.json`
- `data/business/productos.json`
- `data/business/calendario.json`

### Bajo demanda

- `data/business/clientes.geojson`
- `data/business/agregados/ventas_departamento_mes.json`
- `data/business/agregados/ventas_producto_mes.json`
- `data/business/ventas_mensuales.csv`
- capas por provincia desde `provincias_index.json`

---

## Backend

No se implementa backend en V10.3. La próxima fase V10.4 debe decidir con evidencia si conviene mantener Cloudflare Pages estático o sumar Cloudflare R2, Pages Functions, Workers, D1 o Railway/Postgres/PostGIS. Railway/PostGIS solo conviene si hay consultas geoespaciales dinámicas reales, no para resolver contratos de datos estáticos.

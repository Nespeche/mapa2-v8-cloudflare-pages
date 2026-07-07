# Mapa 2 V10.3 — Estabilización, contratos de datos y anti-regresión

**Estado de fase:** V10.3 implementada sobre V10.2 funcional.  
**Deploy objetivo:** Cloudflare Pages Free.  
**Build command:** `npm run build`  
**Build output directory:** `dist`  
**Node:** `22.16.0` según `.node-version`.

Mapa 2 es una app web geoespacial profesional para Argentina basada en **Vite + React + TypeScript + MapLibre**, datos estáticos en `public/data`, carga progresiva y deploy estático en Cloudflare Pages Free.

V10.3 no implementa backend, no rediseña la UI, no regenera V5.1 ni V6 y no cambia el modelo territorial `País → Provincia → Localidad`. La fase agrega contratos internos, validadores runtime, scripts anti-regresión y documentación para impedir que futuras fases rompan funcionalidades ya validadas.

> Los clientes, productos y ventas son datos sintéticos V6. No representan clientes reales ni operaciones reales.

---

## Base preservada

```text
V5.1 — base censal/geográfica preservada
V6   — base comercial sintética de autopartes preservada
V7.1 — fix runtime de frontend preservado
V8   — deploy Cloudflare Pages Free preservado
V9   — UI/UX profesional preservada
V10  — performance/carga progresiva preservada
V10.1 — fix visibilidad de mapa preservado
V10.2 — fix conteo/visibilidad de clientes preservado
V10.3 — contratos de datos y anti-regresión
```

---

## Qué agrega V10.3

- `src/domain/appVersion.ts`, `businessContracts.ts`, `geoContracts.ts`, `dataContracts.ts`.
- `src/data/dataManifest.ts` para centralizar rutas iniciales/lazy.
- `src/data/dataValidators.ts` con validaciones runtime sin dependencias nuevas.
- `src/services/commercialMetrics.ts`, `filterEngine.ts`, `geoEnrichment.ts` como capa progresiva de servicios sin romper `src/utils/aggregations.ts`.
- Scripts nuevos:
  - `npm run check:data-contracts`
  - `npm run check:business-contracts`
  - `npm run check:geo-contracts`
  - `npm run check:map-smoke`
  - `npm run validate:release`
- Documentación V10.3 en `docs/`.

---

## Contratos principales

### Comercial V6

- Clientes: `2.000`.
- Productos: `65`.
- Ventas CSV: `128.998` registros.
- Calendario: `24` meses, de `2025-01` a `2026-12`.
- Agregados esperados:
  - `ventas_cliente_totales.json`: `2.000` clientes.
  - `ventas_departamento_mes.json`: `6.432` registros.
  - `ventas_producto_mes.json`: `1.560` registros.
  - `ventas_provincia_mes.json`: `264` registros.
- IDs de clientes y productos del CSV deben existir en sus maestros.
- Agregados por cliente, departamento/mes, producto/mes y provincia/mes deben cerrar contra el CSV.

### Geográfico/censal V5.1

- `provincias.geojson`: `24` features.
- `provincias_index.json`: `24` provincias.
- IDs territoriales comerciales deben existir en geometrías.
- Ningún asset público debe superar `25 MiB`.
- Radios nacionales, clientes y CSV detallado no se cargan al inicio.

### KPIs

La semántica completa está documentada en `docs/DATA_CONTRACTS_V10_3.md`. En síntesis, `clientesVisibles` significa clientes territoriales filtrados cuando se usan agregados; si el CSV detallado se carga por filtro de período/producto, significa clientes con ventas activas en ese subconjunto.

---

## Instalación local en Windows / PowerShell

Extraer el ZIP en una ruta corta, por ejemplo:

```powershell
C:\Mapa2\mapa2_v10_3_data_contracts_antiregression
```

Entrar a la carpeta:

```powershell
cd C:\Mapa2\mapa2_v10_3_data_contracts_antiregression
```

Instalar dependencias:

```powershell
npm install
```

Ejecutar validaciones:

```powershell
npm run check:client-counts
npm run check:data-contracts
npm run check:business-contracts
npm run check:geo-contracts
npm run check:map-smoke
npm run build
npm run validate:release
```

Correr local:

```powershell
npm run dev
```

Abrir:

```text
http://127.0.0.1:5173/
```

Preview del build:

```powershell
npm run preview
```

Abrir:

```text
http://127.0.0.1:4173/
```

---

## Scripts disponibles

```powershell
npm run dev
npm run build
npm run preview
npm run check:client-counts
npm run check:data-contracts
npm run check:business-contracts
npm run check:geo-contracts
npm run check:map-smoke
npm run check:cloudflare
npm run audit:dist
npm run validate:release
npm run data:minify
```

`validate:release` ejecuta build y los contratos obligatorios de datos, negocio y geografía.

---

## Deploy Cloudflare Pages

Configuración esperada:

```text
Framework preset: React (Vite) o None
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 22.16.0
```

No se requiere backend, Workers, Pages Functions, D1, R2, KV, Railway, Postgres ni PostGIS en V10.3.

---

## Próximo orden documentado

```text
V10.3 — Estabilización, contratos de datos y anti-regresión.
V10.4 — Decisión de arquitectura de carga de datos y backend.
V11 — Implementación de carga de datos/backend si se justifica.
V12 — Refactor y mejora profesional del frontend.
V13 — Analytics comercial avanzado y storytelling.
V14 — Producto final, documentación pública y mantenimiento.
```

Backend no se implementa automáticamente. Railway/Postgres/PostGIS solo debe evaluarse si aparece una necesidad real de consultas geoespaciales dinámicas.

---

## Documentación V10.3

```text
docs/ARCHITECTURE_V10_3.md
docs/DATA_CONTRACTS_V10_3.md
docs/ANTI_REGRESSION_CHECKLIST_V10_3.md
docs/VALIDATION_LOG_V10_3.md
docs/CHANGELOG_V10_3.md
docs/DATA_CONTRACT_AUDIT_V10_3.md
docs/BUSINESS_CONTRACT_AUDIT_V10_3.md
docs/GEO_CONTRACT_AUDIT_V10_3.md
docs/MAP_SMOKE_AUDIT_V10_3.md
```

# Mapa 2 — Skill/Fuente de Proyecto actualizada V10.3

**Versión actual de trabajo:** V10.3 — Estabilización, contratos de datos y anti-regresión.  
**Base inmediata:** V10.2 funcional con mapa visible y conteo de clientes corregido.  
**Modelo territorial:** `País → Provincia → Localidad`.

## Rol

Actuar como arquitecto senior full-stack y desarrollador profesional especializado en apps web geoespaciales, React, Vite, TypeScript, MapLibre, Cloudflare Pages Free, datos GIS, normalización territorial/censal, contratos de datos, QA anti-regresión, performance y UI/UX profesional.

## Reglas de continuidad

- No avanzar de fase sin confirmación explícita del usuario.
- No implementar backend durante V10.3.
- No rediseñar UI durante V10.3.
- No regenerar V5.1 ni V6 salvo error bloqueante documentado.
- No modificar el modelo territorial `País → Provincia → Localidad`.
- Mantener carga progresiva: no cargar `clientes.geojson` ni `ventas_mensuales.csv` al inicio.
- Mantener compatibilidad Cloudflare Pages Free y Windows.
- Entregar ZIP completo, limpio y funcional cuando se pida versión/fix.

## Bases preservadas

```text
V5.1 — base censal/geográfica
V6   — base comercial sintética: 2.000 clientes, 65 productos, 128.998 ventas, 2025-01 a 2026-12
V7.1 — frontend runtime fix
V8   — deploy Cloudflare Pages Free
V9   — UI/UX profesional
V10  — performance/carga progresiva
V10.1 — fix visibilidad de mapa
V10.2 — fix conteo/visibilidad de clientes
V10.3 — contratos internos y anti-regresión
```

## Contratos obligatorios V10.3

- `clientes = 2000`.
- `productos = 65`.
- `ventas_mensuales.csv = 128998` registros.
- Calendario de 24 meses desde `2025-01` hasta `2026-12`.
- Agregados esperados: cliente `2000`, departamento/mes `6432`, producto/mes `1560`, provincia/mes `264`.
- Todos los IDs de ventas deben existir en clientes y productos.
- Todos los IDs territoriales comerciales deben existir en geometrías.
- `provincias.geojson` y `provincias_index.json` deben tener 24 provincias.
- Ningún asset público debe superar 25 MiB.
- `dist` no debe incluir `.gpkg`, `.sqlite`, `.db`, `.zip`, raw data ni outputs pesados.

## Semántica KPI

`clientesVisibles` significa clientes territoriales filtrados cuando se usan agregados. Si el CSV detallado se carga por período/producto, significa clientes con ventas activas en ese subconjunto. `ventaNeta`, `unidades`, `margenBruto`, `ticketPromedio`, líderes y fuente se documentan en `docs/DATA_CONTRACTS_V10_3.md`.

## Validaciones mínimas

Ejecutar y revisar:

```powershell
npm install
npm run check:client-counts
npm run check:data-contracts
npm run check:business-contracts
npm run check:geo-contracts
npm run check:map-smoke
npm run build
npm run validate:release
npm run preview
```

Validación manual: mapa visible, KPIs > 0 sin filtros, Buenos Aires con clientes, Bolívar con clientes, departamentos visibles, clientes/clusters/heatmap bajo demanda, filtro producto carga CSV solo cuando corresponde, Network sin 404 propios y consola sin errores rojos bloqueantes.

## Plan posterior

```text
V10.3 — Estabilización, contratos de datos y anti-regresión.
V10.4 — Decisión de arquitectura de carga de datos y backend.
V11 — Implementación de carga de datos/backend si se justifica.
V12 — Refactor y mejora profesional del frontend.
V13 — Analytics comercial avanzado y storytelling.
V14 — Producto final, documentación pública y mantenimiento.
```

# V11A.1 — Changelog

## Agregado

- Migración `migrations/0002_v11a1_api_read_optimization.sql`.
- Tablas read model `api_*` para endpoints futuros.
- Script `data:d1:readmodels`.
- Script `data:api-cache:build`.
- Script `audit:api-budget`.
- Script `audit:query-plans`.
- Script `validate:v11a1`.
- Cache JSON en `public/data/api-cache`.
- Reportes JSON en `data/d1`.
- Documentación V11A.1 y notas de preparación V11B.

## Modificado

- `package.json` y `package-lock.json` actualizados a V11A.1.
- Se agregaron scripts nuevos sin eliminar scripts V11A existentes.

## Removido del entregable final

- `data/output/arg_geo_censo_semilla.sqlite`, por criterio de no incluir `.sqlite` en el ZIP final.
- `data/raw/georef/municipios.zip`, por criterio de no incluir ZIPs internos en el entregable final.

## No modificado

- No se modificó `src`.
- No se implementaron APIs reales.
- No se conectó frontend a D1.
- No se rediseñó UI.
- No se eliminó `public/data` existente.
- No se regeneró la base comercial sintética.

## Advertencias conocidas

- `public/data/api-cache/localities_by_province/provincia_06.json` y `provincia_14.json` superan 1.5 MB. Están documentados como warning, no como bloqueo, porque no contienen geometrías ni ventas crudas.
- Búsqueda por `LIKE` en alias territorial queda como warning controlado; V11B debe imponer prefijo normalizado y `LIMIT`.

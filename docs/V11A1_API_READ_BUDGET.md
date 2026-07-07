# V11A.1 — API Read Budget

Generado: 2026-07-07T00:00:00.000Z

## Objetivo

Definir el presupuesto de lectura esperado para las APIs futuras V11B, maximizando el uso de assets y read models para no consumir innecesariamente D1 Free.

## Presupuesto por endpoint

| Endpoint | Tabla/asset principal | Máx. devueltas | Máx. escaneadas | Riesgo |
| --- | --- | --- | --- | --- |
| GET /api/health | app_metadata or static response | 1 | 1 | LOW |
| GET /api/metadata | public/data/api-cache/metadata.json | 1 | 4 | LOW |
| GET /api/provinces | public/data/api-cache/provinces.json or api_province_summary | 24 | 24 | LOW |
| GET /api/provinces/:provinceId/localities | public/data/api-cache/localities_by_province/{safe_id}.json or api_locality_summary | 3549 | 3549 | LOW_WITH_INDEX |
| GET /api/localities/:localityId | api_locality_summary | 1 | 2 | LOW |
| GET /api/localities/:localityId/summary | api_locality_summary | 13 | 13 | LOW |
| GET /api/localities/:localityId/clients?page=&pageSize= | api_locality_client_metrics | 50 | 50 | LOW_WITH_INDEX_AND_LIMIT |
| GET /api/clients/:clientId | api_client_sales_summary | 1 | 1 | LOW |
| GET /api/clients/:clientId/sales?from=&to=&productId= | api_client_sales_summary or sale_monthly filtered by client_id + period | 24 | 120 | MEDIUM_IF_PRODUCT_FILTER_WITHOUT_CLIENT |
| GET /api/sales/summary?provinceId=&localityId=&from=&to=&productId= | api_locality_month_summary or sales_aggregate_* | 24 | 100 | MEDIUM_IF_NO_FILTERS |
| GET /api/search/territory?q=&provinceId=&postalCode= | locality, province, territorial_alias, postal_code_area | 20 | 200 | WARNING_WITH_LIKE |

## Riesgos y advertencias

| Nivel | Endpoint | Mensaje |
| --- | --- | --- |
| WARNING | GET /api/clients/:clientId/sales?from=&to=&productId= | Bloquear consultas sin clientId. |
| WARNING | GET /api/sales/summary?provinceId=&localityId=&from=&to=&productId= | No usar sale_monthly para resumen general. |
| WARNING | GET /api/search/territory?q=&provinceId=&postalCode= | LIKE no debe ejecutarse sin LIMIT y normalización. |

## Estrategia Cloudflare Free

- Servir catálogos casi inmutables desde `public/data/api-cache`.
- Usar read models para resumen de localidad, cliente y series mensuales.
- Usar `sale_monthly` solo con filtros altamente selectivos por `client_id`, `product_id` y/o período.
- Limitar `pageSize` a 100 y búsqueda territorial a 20 resultados.
- Revisar los límites vigentes de Cloudflare antes del deploy remoto; V11A conserva la última auditoría en `data/d1/d1_audit_report.json`.

## Estado

WARNING.

# V11A.1 — Validation

Generado: 2026-07-07T00:00:00.000Z

## Estado

OK_WITH_WARNINGS

## Resumen

- Errores: 0
- Advertencias: 3
- Checks ejecutados: 73
- Tamaño SQL read models: 30.38 MB
- Tamaño cache estático: 14.55 MB

## Comandos recomendados de validación completa

```powershell
npm install
npm run data:d1:build
npm run data:d1:validate
npm run data:d1:readmodels
npm run data:api-cache:build
npm run audit:d1
npm run audit:api-budget
npm run audit:query-plans
npm run build
npm run validate:v11a
npm run validate:v11a1
```

## Resultados observados en esta entrega

| Comando | Estado | Log |
| --- | --- | --- |
| npm install | OK | data/d1/validation_logs/00_npm_install.log |
| npm run data:d1:build | WARNING | data/d1/validation_logs/01_data_d1_build.log |
| npm run data:d1:validate | OK | data/d1/validation_logs/02_data_d1_validate.log |
| npm run data:d1:readmodels | OK | data/d1/validation_logs/03_readmodels.log |
| npm run data:api-cache:build | WARNING | data/d1/validation_logs/04_api_cache.log |
| npm run audit:d1 | WARNING | data/d1/validation_logs/05_audit_d1.log |
| npm run audit:api-budget | WARNING | data/d1/validation_logs/06_api_budget.log |
| npm run audit:query-plans | WARNING | data/d1/validation_logs/07_query_plans.log |
| npm run build | WARNING | data/d1/validation_logs/08_build.log |
| npm run validate:v11a | OK | data/d1/validation_logs/09_validate_v11a.log |
| npm run validate:v11a1 | WARNING | data/d1/validation_logs/10_validate_v11a1.log |

## Checks

| Check | Estado | Mensaje |
| --- | --- | --- |
| file:migrations/0002_v11a1_api_read_optimization.sql | OK | Existe migrations/0002_v11a1_api_read_optimization.sql |
| file:data/d1/v11a1_read_models.sql | OK | Existe data/d1/v11a1_read_models.sql |
| file:data/d1/v11a1_read_models_summary.json | OK | Existe data/d1/v11a1_read_models_summary.json |
| file:data/d1/static_cache_summary.json | OK | Existe data/d1/static_cache_summary.json |
| file:data/d1/v11a1_api_read_budget_report.json | OK | Existe data/d1/v11a1_api_read_budget_report.json |
| file:data/d1/v11a1_query_plan_checks.sql | OK | Existe data/d1/v11a1_query_plan_checks.sql |
| file:data/d1/v11a1_query_plan_report.json | OK | Existe data/d1/v11a1_query_plan_report.json |
| file:public/data/api-cache/metadata.json | OK | Existe public/data/api-cache/metadata.json |
| file:public/data/api-cache/provinces.json | OK | Existe public/data/api-cache/provinces.json |
| file:public/data/api-cache/localities_by_province/index.json | OK | Existe public/data/api-cache/localities_by_province/index.json |
| file:public/data/api-cache/products.json | OK | Existe public/data/api-cache/products.json |
| file:public/data/api-cache/periods.json | OK | Existe public/data/api-cache/periods.json |
| file:public/data/api-cache/cache_manifest.json | OK | Existe public/data/api-cache/cache_manifest.json |
| file:docs/V11A1_OPTIMIZATION_PLAN.md | OK | Existe docs/V11A1_OPTIMIZATION_PLAN.md |
| file:docs/V11A1_READ_MODELS.md | OK | Existe docs/V11A1_READ_MODELS.md |
| file:docs/V11A1_STATIC_CACHE.md | OK | Existe docs/V11A1_STATIC_CACHE.md |
| file:docs/V11A1_API_READ_BUDGET.md | OK | Existe docs/V11A1_API_READ_BUDGET.md |
| file:docs/V11A1_QUERY_PLAN_AUDIT.md | OK | Existe docs/V11A1_QUERY_PLAN_AUDIT.md |
| file:docs/V11A1_CLOUDFLARE_FREE_STRATEGY.md | OK | Existe docs/V11A1_CLOUDFLARE_FREE_STRATEGY.md |
| file:docs/V11A1_GITHUB_STEPS.md | OK | Existe docs/V11A1_GITHUB_STEPS.md |
| file:docs/V11A1_CLOUDFLARE_STEPS.md | OK | Existe docs/V11A1_CLOUDFLARE_STEPS.md |
| file:docs/V11A1_ROLLBACK.md | OK | Existe docs/V11A1_ROLLBACK.md |
| file:docs/V11A1_CHANGELOG.md | OK | Existe docs/V11A1_CHANGELOG.md |
| file:docs/V11B_PREPARATION_NOTES.md | OK | Existe docs/V11B_PREPARATION_NOTES.md |
| package-script:data:d1:readmodels | OK | package.json contiene data:d1:readmodels |
| package-script:data:api-cache:build | OK | package.json contiene data:api-cache:build |
| package-script:audit:api-budget | OK | package.json contiene audit:api-budget |
| package-script:audit:query-plans | OK | package.json contiene audit:query-plans |
| package-script:validate:v11a1 | OK | package.json contiene validate:v11a1 |
| schema-table:api_province_summary | OK | Migración crea api_province_summary |
| schema-table:api_locality_summary | OK | Migración crea api_locality_summary |
| schema-table:api_locality_month_summary | OK | Migración crea api_locality_month_summary |
| schema-table:api_locality_top_products | OK | Migración crea api_locality_top_products |
| schema-table:api_locality_client_metrics | OK | Migración crea api_locality_client_metrics |
| schema-table:api_client_sales_summary | OK | Migración crea api_client_sales_summary |
| schema-table:api_query_budget | OK | Migración crea api_query_budget |
| schema-index:idx_api_province_summary_slug | OK | Migración crea índice idx_api_province_summary_slug |
| schema-index:idx_api_locality_summary_province | OK | Migración crea índice idx_api_locality_summary_province |
| schema-index:idx_api_locality_summary_province_name | OK | Migración crea índice idx_api_locality_summary_province_name |
| schema-index:idx_api_locality_month_locality_period | OK | Migración crea índice idx_api_locality_month_locality_period |
| schema-index:idx_api_locality_month_province_period | OK | Migración crea índice idx_api_locality_month_province_period |
| schema-index:idx_api_locality_top_products_loc_rank | OK | Migración crea índice idx_api_locality_top_products_loc_rank |
| schema-index:idx_api_locality_client_loc_rank | OK | Migración crea índice idx_api_locality_client_loc_rank |
| schema-index:idx_api_client_sales_locality | OK | Migración crea índice idx_api_client_sales_locality |
| schema-index:idx_api_query_budget_endpoint | OK | Migración crea índice idx_api_query_budget_endpoint |
| schema-forbidden:SERIAL | OK | Migración no contiene SERIAL |
| schema-forbidden:JSONB | OK | Migración no contiene JSONB |
| schema-forbidden:GEOMETRY | OK | Migración no contiene GEOMETRY |
| schema-forbidden:GEOGRAPHY | OK | Migración no contiene GEOGRAPHY |
| schema-forbidden:ST_* | OK | Migración no contiene ST_* |
| schema-forbidden:ILIKE | OK | Migración no contiene ILIKE |
| schema-drop-table | OK | Migración no contiene DROP TABLE |
| data-province-count | OK | api_province_summary=24 |
| data-locality-count | OK | api_locality_summary=21289 |
| data-client-metrics-count | OK | api_locality_client_metrics=2000 |
| data-client-summary-count | OK | api_client_sales_summary=2000 |
| data-product-count | OK | Productos=65 |
| data-sales-count | OK | Ventas preservadas=128998 |
| data-synthetic-flag | OK | Datos sintéticos preservados/documentados |
| cache-file-count | OK | Cache contiene 29 archivos |
| cache-size-warning | WARNING | Cache con advertencias de tamaño: 2 |
| cache-provinces-not-empty | OK | provinces.json filas=24 |
| cache-locality-index-not-empty | OK | index localidades filas=24 |
| cache-products-raw-sales | OK | products.json no contiene ventas crudas |
| cache-heavy-geometry | OK | Cache no contiene geometrías pesadas |
| budget-endpoint-count | OK | Presupuesto cubre 11 endpoints |
| budget-status | OK | API budget status=WARNING |
| query-plan-status | OK | Query plan status=WARNING |
| query-plan-like-warning | WARNING | LIKE territorial queda como WARNING controlado con LIMIT |
| forbidden-files | OK | No hay .env, .sqlite, .db ni .zip internos |
| local-exclusion-dirs | WARNING | Directorios locales presentes y excluidos del ZIP final: .git/, node_modules/ |
| readmodel-sale-fullscan | OK | Read model SQL no recomienda full scan sobre sale_monthly |
| readmodel-geometry-json | OK | Read models no incluyen geometrías pesadas |

## Advertencias

| Warning | Mensaje |
| --- | --- |
| cache-size-warning | Cache con advertencias de tamaño: 2 |
| query-plan-like-warning | LIKE territorial queda como WARNING controlado con LIMIT |
| local-exclusion-dirs | Directorios locales presentes y excluidos del ZIP final: .git/, node_modules/ |

## Errores

Sin errores bloqueantes.

# V11A.1 — Query Plan Audit

Generado: 2026-07-07T00:00:00.000Z

## Objetivo

Prevenir full scans críticos antes de implementar Pages Functions V11B. Este script genera SQL de `EXPLAIN QUERY PLAN` y valida que existan índices adecuados en las migraciones.

## SQL generado

`data/d1/v11a1_query_plan_checks.sql`

## Checks

| Check | Consulta | Índice esperado | Estado | Nota |
| --- | --- | --- | --- | --- |
| locality_by_pk | api_locality_summary WHERE locality_id = ? | PRIMARY KEY api_locality_summary(locality_id) | OK | Debe resolver por PK. |
| localities_by_province | api_locality_summary WHERE province_id = ? ORDER BY name LIMIT 500 | idx_api_locality_summary_province_name | OK | ORDER BY name puede requerir sort; para V11B conviene ordenar por name_normalized o aceptar sort acotado. |
| locality_clients_ranked | api_locality_client_metrics WHERE locality_id = ? ORDER BY rank_net_sales LIMIT 50 | idx_api_locality_client_loc_rank | OK | Paginación obligatoria y pageSize máximo 100. |
| locality_top_products | api_locality_top_products WHERE locality_id = ? ORDER BY rank_net_sales LIMIT 10 | idx_api_locality_top_products_loc_rank | OK | Top products está precalculado; no escanear ventas crudas. |
| client_summary_by_pk | api_client_sales_summary WHERE client_id = ? | PRIMARY KEY api_client_sales_summary(client_id) | OK | Resuelve detalle/resumen por cliente con una fila. |
| postal_code_lookup | postal_code_area WHERE postal_code = ? LIMIT 20 | idx_postal_code_area_cp | OK | Código postal solo como señal auxiliar territorial. |
| territory_alias_like | territorial_alias WHERE alias_normalized LIKE 'san%' LIMIT 20 | idx_alias_normalized | WARNING | LIKE puede usar índice solo con prefijo y collation compatible; imponer LIMIT y normalizar q. |
| locality_month_by_locality_period | api_locality_month_summary WHERE locality_id = ? AND period_yyyymm BETWEEN ? AND ? | idx_api_locality_month_locality_period | OK | Adecuado para serie mensual por localidad. |
| locality_month_by_province_period | api_locality_month_summary WHERE province_id = ? AND period_yyyymm BETWEEN ? AND ? | idx_api_locality_month_province_period | OK | Adecuado para resúmenes provinciales sin sale_monthly. |

## Consultas que deben evitarse

- `SELECT * FROM sale_monthly` sin filtros.
- Agregar totales por provincia/localidad leyendo ventas crudas en cada request.
- Búsquedas `LIKE '%texto%'` sin límite estricto.
- Devolver geometría pesada inline.

## Estado final

WARNING. El check `territory_alias_like` queda como WARNING por naturaleza de LIKE; en V11B debe usarse con prefijo normalizado, LIMIT y debounce.

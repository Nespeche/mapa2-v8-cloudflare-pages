-- Mapa 2 V11A.1 — EXPLAIN QUERY PLAN checks
-- Ejecutar luego de aplicar migrations/0001 + 0002 y cargar data/d1/v11a1_read_models.sql.

EXPLAIN QUERY PLAN
SELECT * FROM api_locality_summary WHERE locality_id = 'departamento:06749';

EXPLAIN QUERY PLAN
SELECT * FROM api_locality_summary WHERE province_id = 'provincia:06' ORDER BY name LIMIT 500;

EXPLAIN QUERY PLAN
SELECT * FROM api_locality_client_metrics WHERE locality_id = 'departamento:06749' ORDER BY rank_net_sales LIMIT 50;

EXPLAIN QUERY PLAN
SELECT * FROM api_locality_top_products WHERE locality_id = 'departamento:06749' ORDER BY rank_net_sales LIMIT 10;

EXPLAIN QUERY PLAN
SELECT * FROM api_client_sales_summary WHERE client_id = 'C00001';

EXPLAIN QUERY PLAN
SELECT * FROM postal_code_area WHERE postal_code = '1646' LIMIT 20;

EXPLAIN QUERY PLAN
SELECT * FROM territorial_alias WHERE alias_normalized LIKE 'san%' LIMIT 20;

EXPLAIN QUERY PLAN
SELECT * FROM api_locality_month_summary WHERE locality_id = 'departamento:06749' AND period_yyyymm BETWEEN '2025-01' AND '2026-12' ORDER BY period_yyyymm;

EXPLAIN QUERY PLAN
SELECT * FROM api_locality_month_summary WHERE province_id = 'provincia:06' AND period_yyyymm BETWEEN '2025-01' AND '2026-12' ORDER BY period_yyyymm;

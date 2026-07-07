-- Mapa 2 V11A.1 — Cloudflare Free + API read optimization
-- Crea read models D1 para futuras APIs V11B/V11C sin modificar destructivamente V11A.
-- Compatible con SQLite / Cloudflare D1. No usa PostGIS ni sintaxis no soportada.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS api_province_summary (
  province_id TEXT PRIMARY KEY,
  slug TEXT,
  name TEXT NOT NULL,
  name_normalized TEXT,
  locality_count INTEGER,
  client_count INTEGER,
  population_2022 INTEGER,
  net_sales_total REAL,
  units_total REAL,
  gross_margin_total REAL,
  first_period TEXT,
  last_period TEXT,
  centroid_lat REAL,
  centroid_lng REAL,
  bbox_min_lng REAL,
  bbox_min_lat REAL,
  bbox_max_lng REAL,
  bbox_max_lat REAL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_province_summary_slug ON api_province_summary(slug);
CREATE INDEX IF NOT EXISTS idx_api_province_summary_name ON api_province_summary(name_normalized);

CREATE TABLE IF NOT EXISTS api_locality_summary (
  locality_id TEXT PRIMARY KEY,
  province_id TEXT NOT NULL,
  province_name TEXT,
  slug TEXT,
  name TEXT NOT NULL,
  name_normalized TEXT,
  source_type TEXT,
  population_2022 INTEGER,
  postal_code_primary TEXT,
  client_count INTEGER,
  product_count INTEGER,
  sales_count INTEGER,
  net_sales_total REAL,
  units_total REAL,
  gross_margin_total REAL,
  volume_kg_total REAL,
  first_period TEXT,
  last_period TEXT,
  top_products_json TEXT,
  centroid_lat REAL,
  centroid_lng REAL,
  bbox_min_lng REAL,
  bbox_min_lat REAL,
  bbox_max_lng REAL,
  bbox_max_lat REAL,
  updated_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id)
);

CREATE INDEX IF NOT EXISTS idx_api_locality_summary_province ON api_locality_summary(province_id);
CREATE INDEX IF NOT EXISTS idx_api_locality_summary_province_name ON api_locality_summary(province_id, name_normalized);
CREATE INDEX IF NOT EXISTS idx_api_locality_summary_slug ON api_locality_summary(slug);

CREATE TABLE IF NOT EXISTS api_locality_month_summary (
  summary_id TEXT PRIMARY KEY,
  locality_id TEXT NOT NULL,
  province_id TEXT,
  period_yyyymm TEXT NOT NULL,
  year INTEGER,
  month INTEGER,
  client_count INTEGER,
  sales_count INTEGER,
  product_count INTEGER,
  units REAL,
  net_sales REAL,
  estimated_cost REAL,
  gross_margin REAL,
  volume_kg REAL,
  updated_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id)
);

CREATE INDEX IF NOT EXISTS idx_api_locality_month_locality_period ON api_locality_month_summary(locality_id, period_yyyymm);
CREATE INDEX IF NOT EXISTS idx_api_locality_month_province_period ON api_locality_month_summary(province_id, period_yyyymm);

CREATE TABLE IF NOT EXISTS api_locality_top_products (
  row_id TEXT PRIMARY KEY,
  locality_id TEXT NOT NULL,
  province_id TEXT,
  product_id TEXT NOT NULL,
  product_name TEXT,
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  rank_net_sales INTEGER,
  rank_units INTEGER,
  units REAL,
  net_sales REAL,
  gross_margin REAL,
  period_from TEXT,
  period_to TEXT,
  updated_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id),
  FOREIGN KEY (product_id) REFERENCES product(product_id)
);

CREATE INDEX IF NOT EXISTS idx_api_locality_top_products_loc_rank ON api_locality_top_products(locality_id, rank_net_sales);
CREATE INDEX IF NOT EXISTS idx_api_locality_top_products_product ON api_locality_top_products(product_id);

CREATE TABLE IF NOT EXISTS api_locality_client_metrics (
  row_id TEXT PRIMARY KEY,
  locality_id TEXT NOT NULL,
  province_id TEXT,
  client_id TEXT NOT NULL,
  client_name TEXT,
  segment TEXT,
  client_type TEXT,
  postal_code TEXT,
  lat REAL,
  lng REAL,
  sales_count INTEGER,
  product_count INTEGER,
  units REAL,
  net_sales REAL,
  gross_margin REAL,
  first_period TEXT,
  last_period TEXT,
  rank_net_sales INTEGER,
  updated_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id),
  FOREIGN KEY (client_id) REFERENCES client(client_id)
);

CREATE INDEX IF NOT EXISTS idx_api_locality_client_loc_rank ON api_locality_client_metrics(locality_id, rank_net_sales);
CREATE INDEX IF NOT EXISTS idx_api_locality_client_client ON api_locality_client_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_api_locality_client_province ON api_locality_client_metrics(province_id);

CREATE TABLE IF NOT EXISTS api_client_sales_summary (
  client_id TEXT PRIMARY KEY,
  client_name TEXT,
  province_id TEXT,
  locality_id TEXT,
  postal_code TEXT,
  segment TEXT,
  client_type TEXT,
  sales_count INTEGER,
  product_count INTEGER,
  units REAL,
  net_sales REAL,
  estimated_cost REAL,
  gross_margin REAL,
  volume_kg REAL,
  first_period TEXT,
  last_period TEXT,
  monthly_summary_json TEXT,
  top_products_json TEXT,
  updated_at TEXT,
  FOREIGN KEY (province_id) REFERENCES province(province_id),
  FOREIGN KEY (locality_id) REFERENCES locality(locality_id),
  FOREIGN KEY (client_id) REFERENCES client(client_id)
);

CREATE INDEX IF NOT EXISTS idx_api_client_sales_locality ON api_client_sales_summary(locality_id);
CREATE INDEX IF NOT EXISTS idx_api_client_sales_province ON api_client_sales_summary(province_id);

CREATE TABLE IF NOT EXISTS api_query_budget (
  budget_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  future_phase TEXT NOT NULL,
  expected_tables TEXT,
  expected_max_rows_returned INTEGER,
  expected_max_rows_scanned INTEGER,
  requires_pagination INTEGER,
  cache_strategy TEXT,
  risk_level TEXT,
  notes TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_query_budget_endpoint ON api_query_budget(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_query_budget_phase ON api_query_budget(future_phase);

INSERT OR REPLACE INTO schema_migrations (migration_id, applied_at, description)
VALUES ('0002_v11a1_api_read_optimization', '2026-07-07T00:00:00.000Z', 'V11A.1 read models, API read budget and Cloudflare Free optimization schema');
